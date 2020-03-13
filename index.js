require("dotenv").config();
require("./models/dbInit");
const express = require("express");
const url = require('url');
const SpotifyWebApi = require('spotify-web-api-node');
const Features = require("./models/Features");
const { shuffle } = require("./ml/shuffle");
const { getAccuracy } = require("./ml/getAccuracy");
const brain = require("brain.js");
const fetch = require("node-fetch");



const app = express();
const port = process.env.PORT || 3000;


const id = process.env.Client_ID;
const secret = process.env.Client_Secret;
const redirect_uri = process.env.Redirect_URI;
const spotifyUserID = 'mw2fpybb2yogbq6lyc7twy235';

const scopes = ["playlist-read-collaborative", "playlist-read-private", "playlist-modify-private", "playlist-modify-public"];
const state = 'some-state-of-my-choice';

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.Client_ID,
  clientSecret: process.env.Client_Secret,
  redirectUri: process.env.Redirect_URI
});


const SelectedFeatures = [];


// Setting credentials can be done in the wrapper's constructor, or using the API object's setters.
// Create the authorization URL
var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);

function generateRandomString(length) {
  let text = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}


const refreshSpotifyToken = () => {
  spotifyApi.refreshAccessToken().then(
    function (data) {
      console.log('The access token has been refreshed!');

      // Save the access token so that it's used in future calls
      spotifyApi.setAccessToken(data.body['access_token']);
    },
    function (err) {
      console.log('Could not refresh access token', err);
    }
  );
}

/* app.get("/login", function(req, res) {}); */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/spotifyLogin", (req, res) => {
  console.log('Loggin in ....')
  res.redirect(authorizeURL);
});

app.get("/spotifyCallback", (req, res) => {
  console.log('callback');
  spotifyApi.authorizationCodeGrant(req.query.code).then(
    function (data) {
      console.log('The token expires in ' + data.body['expires_in']);
      console.log('The access token is ' + data.body['access_token']);
      console.log('The refresh token is ' + data.body['refresh_token']);

      // Set the access token on the API object to use it in later calls
      spotifyApi.setAccessToken(data.body['access_token']);
      spotifyApi.setRefreshToken(data.body['refresh_token']);
      // res.redirect('http://localhost:3000/getPlaylist');
    },
    function (err) {
      console.log('Something went wrong!', err);
    }
  );
});

app.get("/getPlaylist", async (req, res) => {
  refreshSpotifyToken();
  console.log('PLAYLIST ROUTE')
  try {
    const userId = req.query.userId || 'thelinmichael';
    console.log(userId);
    const response = await spotifyApi.getUserPlaylists(userId)
    if (!response) return res.json({ error: '/getPlaylist error: Permission not there' });
    const playlist = response.body.items[0];
    console.log(response);
    const url = `/getTracks?id=${playlist.id}&userId=${userId}`;
    console.log(url);
    res.redirect(url);
  } catch (err) {
    console.log("Failed to get the playlist");
  }
});

app.get("/getTracks", async (req, res) => {
  refreshSpotifyToken();
  console.log(`tracks route: ${req.query.id}`);
  console.log(`user name: ${req.query.userId}`);
  try {
    const response = await spotifyApi.getPlaylist(req.query.id);
    console.log("errr", response);
    const tracks = response.body.tracks.items;
    const trackIds = [];
    tracks.forEach(t => {
      trackIds.push(t.track.id);
    })
    console.log("trackIds");
    console.log(trackIds);
    const audioResponse = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    const audio_Features = audioResponse.body.audio_features;
    console.log("Feature Vector");

    audio_Features.forEach(track => {
      SelectedFeatures.push(Object.values(track).slice(0, 11));
    });
    console.log(SelectedFeatures);
    if (!SelectedFeatures) return res.json({ error: "Selected Features not found" });

    const userExists = await Features.find({ userId: req.query.userId });
    if (Object.keys(userExists).length != 0) {
      if (userExists) return console.log('already in db');
    }
    Features
      .create({ userId: req.query.userId, data: SelectedFeatures })
      .then(res => console.log("Successfully enetered into Db", res))
      .catch(err => console.log(err));

  } catch (err) {
    console.log(err);
  }
});

const mergeArr = (arr) => {
  return [...new Set([].concat(...arr))];
}

function fixLengths(data) {
  let maxLengthInput = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].input.length > maxLengthInput) {
      maxLengthInput = data[i].input.length;
    }
  }

  for (let i = 0; i < data.length; i++) {
    while (data[i].input.length < maxLengthInput) {
      data[i].input.push(0);
    }
  }

  return data;
}
app.post('/nnModel', async (req, res) => {
  console.log("nmodel ROUTE");
  const uid = req.query.userId || 'matt';
  const inputTrack = req.body.input;
  try {
    const samples = await Features.find({ userId: uid });
    if (samples.length === 0) return res.status(500).send('No dataset available for this user');
    const dataset = samples[0].data;
    const labels = [];
    for (i in dataset) {
      labels.push([1, 0]);
    }
    const orderedData = dataset.map((sample, index) => {
      return {
        input: sample,
        output: labels[index]
      }
    });

    const shuffledData = shuffle(orderedData);
    let percentage = 0.5;
    const SPLIT = Math.floor(percentage * shuffledData.length);
    const trainData = shuffledData.slice(0, SPLIT);
    const testData = shuffledData.slice(SPLIT, shuffledData.length);
    const net = new brain.NeuralNetwork({ hiddenLayers: [2] });
    const stat = net.train(trainData, {
      log: (error) => console.log(error),
      logPeriod: 100,
      iterations: 1e6,
    });
    //console.log(net.run(testData[1].input));
    console.log(getAccuracy(net, testData));
    if (!inputTrack) return res.status(500).json({ err: "No input for nnmodel" });
    const result = net.run(inputTrack);
    // console.log(result);
    //console.log(inputTrack);  
    return res.status(200).send(Math.max(result[0], result[1]).toString());

    /*  const net = new brain.NeuralNetwork({
       activation: 'sigmoid', // activation function
       hiddenLayers: [2],
       iterations: 1e6,
       learningRate: 0.5 // global learning rate, useful when training using streams
     });
     net.train(fixLengths(trainData));
     console.log(net.run(testData)); */
    /*const accuracy = getAccuracy(net, testData);
  console.log('accuracy: ', accuracy);*/
  } catch (err) {
    console.log(err);
  }
  return true;
});


const getData = async (url, settings) => {
  try {
    const response = await fetch(url, settings);
    const json = await response.json();
    return json;
  } catch (error) {
    console.log(error);
    return false;
  }
};


app.post('/match', async (req, res) => {
  let user = req.query.user;
  let friend = req.query.friend;
  let dataset, result;
  try {
    result = await Features.findOne({ userId: friend });
    dataset = result.data;
    console.log(result);
  } catch (err) {
    console.log(err);
  }
  let mean = 0;
  try {
    Promise
      .all(dataset.map(data => {
        console.log(data);
        const url = `http://localhost:3000/nnModel?userId=${user}`;
        let content = {
          input: data
        }
        const settings = {
          method: "POST",
          body: JSON.stringify(content),
          headers: { 'Content-Type': 'application/json' },

        };
        return getData(url, settings);
      }))
      .then((resolvedValues) => {
        let mean = 0;
        resolvedValues.forEach((value) => {
          mean += Number(value);
        });
        mean /= resolvedValues.length;
        res.status(200).send(mean.toString());
      })

  } catch (err) {
    console.log(err);
  }
  return true;
});

app.post("/analyse", async (req, res) => {
  const main = req.query.user;
  try {
    const allUsers = await Features.find({
      userId: {
        $ne: main
      }
    }, { data: 0 });
    Promise
      .all(allUsers.map(async user => {
        const url = `http://localhost:3000/match?user=${main}&friend=${user.userId}`;
        return getData(url, { method: 'POST' });
      })).then((resolvedValues) => {
        resolvedValues.forEach((ele) => {
          console.log(ele);
        })
      });
  } catch (err) {
    console.log(err);
  }
})



app.use((req, res, next) => {
  const error = new Error(`${req.originalUrl} [Route not found]`);
  res.status(404);
  next(error);
});


app.use((error, req, res, next) => {
  const statusCode = res.statusCode == 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    error: error.message
  })
});
app.listen(port, () => {
  console.log(`Server started at ${port}`);
});

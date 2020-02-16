require("dotenv").config();
const express = require("express");
const getPlayList = require("./getPlaylist");
const url = require('url');
const SpotifyWebApi = require('spotify-web-api-node');



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

/* app.get("/login", function(req, res) {}); */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/spotifyLogin", (req, res) => {
  res.redirect(authorizeURL);
});

app.get("/spotifyCallback", (req, res) => {
  spotifyApi.authorizationCodeGrant(req.query.code).then(
    function (data) {
      console.log('The token expires in ' + data.body['expires_in']);
      console.log('The access token is ' + data.body['access_token']);
      console.log('The refresh token is ' + data.body['refresh_token']);

      // Set the access token on the API object to use it in later calls
      spotifyApi.setAccessToken(data.body['access_token']);
      spotifyApi.setRefreshToken(data.body['refresh_token']);
      res.redirect('http://localhost:3000/getPlaylist');
    },
    function (err) {
      console.log('Something went wrong!', err);
    }
  );
});

app.get("/getPlaylist", async (req, res) => {
  console.log('PLAYLIST ROUTE')
  try {
    const userId = 'thelinmichael'
    const response = await spotifyApi.getUserPlaylists(userId)
    const playlist = response.body.items[0];
    res.redirect(`http://localhost:3000/getTracks/${playlist.id}`);
  } catch (err) {
    console.log("Failed to get the playlist");
  }
});

app.get("/getTracks/:id", async (req, res) => {
  console.log(`tracks route: ${req.params.id}`);
  try {
    const response = await spotifyApi.getPlaylist(req.params.id);
    const tracks = response.body.tracks.items;
    const trackIds = [];
    tracks.forEach(t => {
      trackIds.push(t.track.id);
    })
    console.log("trackIds");
    console.log(trackIds);
    const audioResponse = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    const Features = audioResponse.body.audio_features;
    console.log("Feature Vector");

    Features.forEach(track => {
      SelectedFeatures.push(Object.values(track).slice(0, 11));
    });
    console.log(SelectedFeatures);
  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server started at ${port}`);
});

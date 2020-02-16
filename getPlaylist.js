const getApiData = require("./getApiData");

const getPlayList = async (userId, spotifyApi) => {
  const playlists = await spotifyApi.getUserPlaylists(userId);
  const playlistId = playlists.body.items[0].id;
  console.log('Retrieved playlists');
  console.log(playlistId);
  let playlistTracks = await spotifyApi.getPlaylistTracks(userId, playlistId, {
    offset: 1,
    limit: 100,
    fields: 'items'
  });
  console.log(playlistTracks);
  return playlistTracks;
};

module.exports = getPlayList;

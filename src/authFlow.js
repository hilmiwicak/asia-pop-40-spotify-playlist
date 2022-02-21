import SpotifyWebAPI from "spotify-web-api-node";
import { startServer } from "./functions.js";
import "dotenv/config.js";

(async () => {
  startServer();

  const spotifyAPI = new SpotifyWebAPI({
    redirectUri: "http://localhost:3000/get-token-hash",
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  const token = 'PUT TOKEN HERE';

  spotifyAPI.authorizationCodeGrant(token)
    .then(
        (data) => {
            console.log('token expires : ' + data.body['expires_in']);
            console.log('access token  : ' + data.body['access_token']);
            console.log('refresh token : ' + data.body['refresh_token']);

            spotifyAPI.setAccessToken(data.body['access_token']);
            spotifyAPI.setRefreshToken(data.body['refresh_token']);
            spotifyAPI.searchTracks('track:Alright artist:Kendrick Lamar')
              .then(function(data) {
                  console.log('hasil aight kendrick :' + Object.keys(data.body.tracks));
              }, err => {
                  console.log(`err : ${err}`);
              })
        },
        err => {
            console.log(`error : ${err}`);
        }
    )
})();

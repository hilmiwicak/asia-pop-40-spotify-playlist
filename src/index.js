import {
  getAP40csv,
  parseAP40csv,
  startServer,
  automateSpotifyToken,
  getSpotifyAccessToken,
  removeSpotifyPlaylistSongs,
  searchSpotifySongURIs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
} from "./ap40.js";

/**
 * NOTES :
 * how do you kill server child process not through timeout?
 * dynamic redirectURL inside getSpotifyToken
 * parallel search spotify track's URI
 */

(async () => {
  let chartList, authToken, accessToken, songsURI;

  await getAP40csv();
  chartList = await parseAP40csv();

  startServer();
  authToken = await automateSpotifyToken();
  accessToken = await getSpotifyAccessToken(authToken);

  removeSpotifyPlaylistSongs(accessToken);

  songsURI = await searchSpotifySongURIs(accessToken, chartList);

  addSpotifyPlaylistSongs(accessToken, songsURI);

  updateSpotifyPlaylistTitle(accessToken);

})();

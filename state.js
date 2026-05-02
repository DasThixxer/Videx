import { SB_PLAYLISTS_URL } from "./config.js";

export const state = {
  currentSort:          "-views",
  currentSource:        "porntubeai",
  currentPlaylistTitle: "",
  VIDEOS:               [],
  currentId:            null,
  apiMode:              "playlists",
  sbMode:               "playlists",
  SB_PLAYLISTS:         [],
  sbCurrentUrl:         SB_PLAYLISTS_URL,
  sbNextPageUrl:        null,
  sbLoadingMore:        false,
  sbInSearch:           false,
  currentPage:          1,
  apiLoadingMore:       false,
  restoringHistory:     false,
};

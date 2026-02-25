import API from "./api"; // or wherever your axios instance is

export const pingPresence = () =>
  API.post("/presence/ping");


export const getPresenceUsers = () =>
  API.get("/presence/users");
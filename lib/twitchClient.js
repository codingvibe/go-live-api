import axios from 'axios';
import { nanoid } from 'nanoid';
import { URLSearchParams } from 'url';

const TWITCH_API_URL = "https://api.twitch.tv/helix";

export class TwitchClient {
  constructor(clientId, clientSecret, eventSubSecret, redirectUrl, stateTTL) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.eventSubSecret = eventSubSecret;
    this.redirectUrl = redirectUrl;
    this.stateTTL = stateTTL;
    this.appAccessToken = null;
    this.appAccessTokenExpiration = null;
    this.states = {};
  }

  async refreshTwitchAuthToken(refreshToken) {
    const authUrl = `https://id.twitch.tv/oauth2/token?client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=refresh_token&refresh_token=${refreshToken}`
    const response = await axios.post(authUrl);
    if (response.status > 299) {
      console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
      return null;
    }
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token
    }
  }

  async getUser(accessToken) {
    const url = `${TWITCH_API_URL}/users`;
    const response = await axios.get(url, {
      headers: {
        "Client-Id": this.clientId,
        "Authorization": `Bearer ${accessToken}`
      }
    });
    if (response.status > 299) {
      console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
      return null;
    }
    return response.data.data[0];
  }

  async getCurrentChannelInfo(accessToken, broadcasterId) {
    const url = `${TWITCH_API_URL}/channels?broadcaster_id=${broadcasterId}`
    const response = await axios.get(url, {
      headers: {
        "Client-Id": this.clientId,
        "Authorization": `Bearer ${accessToken}`
      }
    });
    if (response.status > 299) {
      console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
      return null;
    }
    return response.data.data[0];
  }

  async hasGoLiveEventSub(broadcasterId) {
    const url = `${TWITCH_API_URL}/eventsub/subscriptions?user_id=${broadcasterId}`;
    const appAccessToken = await this.getAppAccessToken();
    const response = await axios.get(url, {
      headers: {
        "Client-Id": this.clientId,
        "Authorization": `Bearer ${appAccessToken}`
      }
    });
    if (response.status > 299) {
      console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
      return null;
    }
    const eventSubs = response.data.data;
    for (let i = 0; i < eventSubs.length; i++) {
      if (eventSubs[i].type == "stream.online" && eventSubs[i].status == "enabled") {
        return true;
      }
    }
    return false;
  }

  async createGoLiveEventSub(broadcasterId) {
    const url = `${TWITCH_API_URL}/eventsub/subscriptions`
    const appAccessToken = await this.getAppAccessToken();
    const response = await axios.post(url, {
      "type": "stream.online",
      "version": "1",
      "condition": {
        "broadcaster_user_id": broadcasterId
      },
      "transport": {
        "method": "webhook",
        "callback": "https://twitchbotapi.codingvibe.dev/golive/eventsub",
        "secret": this.eventSubSecret
      }
    }, {
      headers: {
        "Client-Id": this.clientId,
        "Authorization": `Bearer ${appAccessToken}`
      }
    });
    if (response.status > 299) {
      console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
      return null;
    }
  }

  getLoginUrl() {
    const state = nanoid();
    this.states[state] = Date.now() + this.stateTTL;
    return `https://id.twitch.tv/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${this.redirectUrl}&state=${state}&response_type=code&scope=`;
  }

  isStateValid(state) {
    if (!(state in this.states) || this.states[state] < Date.now()) {
      return false;
    }
    delete this.states[state];
    return true;
  }

  async getTokens(code) {
    const url = "https://id.twitch.tv/oauth2/token"
    const body = new URLSearchParams({
      "client_id": this.clientId,
      "client_secret": this.clientSecret,
      "redirect_uri": this.redirectUrl,
      "grant_type": "authorization_code",
      "code": code
    });
    try {
      const response = await axios.post(url, body.toString());
      if (response.status > 299) {
        console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
        return null;
      }
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token
      }
    } catch (e) {
      console.error(e);
    }
  }

  async getAppAccessToken() {
    if (this.appAccessTokenExpiration && Date.now() - this.appAccessTokenExpiration > 0) {
      return this.appAccessToken;
    }
    const url = "https://id.twitch.tv/oauth2/token"
    const body = new URLSearchParams({
      "client_id": this.clientId,
      "client_secret": this.clientSecret,
      "grant_type": "client_credentials"
    });
    try {
      const response = await axios.post(url, body.toString());
      if (response.status > 299) {
        console.error(`Ding dangit, had a dang ol issue with Twitch. ${response.data}`);
        return null;
      }
      this.appAccessToken = response.data.access_token;
      this.appAccessTokenExpiration = Date.now() + response.data.expires_in * 1000;
      return this.appAccessToken;
    } catch (e) {
      console.error(e);
    }
  }
}  

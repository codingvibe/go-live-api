import { TwitterApi } from 'twitter-api-v2';
import fetch from 'node-fetch';

export class TwitterClient {
  constructor(clientId, clientSecret, stateTTL, redirectUrl) {
    this.twitterClient = new TwitterApi({
      clientId: clientId,
      clientSecret: clientSecret
    });
    this.stateTTL = stateTTL;
    this.redirectUrl = redirectUrl;
    this.states = {};
    this.codeVerifiers = {};
  }

  async createTweet(refreshToken, message, image, altText) {
    const { client: refreshedClient, _, refreshToken: newRefreshToken } = await this.twitterClient.refreshOAuth2Token(refreshToken);
    if (image) {
      try {
        const data = await fetch(image, {
          size: 15*1000*1000
        });
        if (data.status > 399) {
          console.error(`Response ${data.status} when trying to get image from url ${image}`);
          return;
        }
        const blob = await (await data.blob()).arrayBuffer();
        const mediaId = await refreshedClient.v1.uploadMedia(Buffer.from(blob), { mimeType: data.mimeType });
        await refreshedClient.v1.createMediaMetadata(mediaId, { alt_text: { text: altText } });
        await refreshedClient.v1.tweet(message, { media_ids: [ mediaId ] });
      } catch(e) {
        console.error("Error tweeting!", e);
        return null;
      }
    } else {
      await refreshedClient.v2.tweet(message);
    }
    return newRefreshToken;
  }

  async getAuthTokens(state, code) {
    if (!state || !(state in this.codeVerifiers) || !(state in this.states) || this.states[state] < Date.now()) {
      throw new Error("Invalid state received");
    }
    delete this.states[state];
    const codeVerifier = this.codeVerifiers[state];
    const { accessToken, refreshToken } = await this.twitterClient.loginWithOAuth2({ code, codeVerifier, redirectUri: this.redirectUrl });
    return {
      accessToken,
      refreshToken
    }
  }

  getAuthUrl() {
    const { url, codeVerifier, state } = this.twitterClient.generateOAuth2AuthLink(this.redirectUrl, { scope: ['tweet.write', 'offline.access'] });
    this.states[state] = Date.now() + this.stateTTL;
    this.codeVerifiers[state] = codeVerifier;
    return url;
  }
}
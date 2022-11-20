import { Pool, DataTypeOIDs } from 'postgresql-client';
import { nanoid } from 'nanoid';

export class UserDao {
  constructor(host, port, username, password, database) {
    this.db = new Pool({
      host: host,
      port: port,
      user: username,
      password: password,
      database: database,
      pool: {
          min: 1,
          max: 10,
          idleTimeoutMillis: 5000
      }
    });
  }

  async createNewUser(twitchUsername, twitchRefreshToken) {
    const res = await this.db.query(
      'INSERT INTO user_data ("twitchId", "connections", "goLiveText") VALUES ($1, $2, $3)',
      { params: [twitchUsername, JSON.stringify([{"type": "twitch", "refreshToken": twitchRefreshToken}]), "{{title}} https://twitch.tv/{{twitchName}}"]});
    return res;
  }

  async getUserConnections(twitchUsername) {
    const res = await this.db.query(
      'SELECT connections FROM user_data WHERE "twitchId" = $1',
      { params: [twitchUsername] });
    if (res.rows.length == 0) {
      return null;
    }
    return JSON.parse(res.rows[0][0]);
  }

  async setUserConnections(twitchUsername, connections) {
    const res = await this.db.query(
      'UPDATE user_data SET connections = $1 WHERE "twitchId" = $2',
      { params: [JSON.stringify(connections), twitchUsername] });
    return res;
  }

  async getGoLiveText(twitchUsername) {
    const res = await this.db.query(
      'SELECT "goLiveText" FROM user_data WHERE "twitchId" = $1',
      { params: [twitchUsername] });
    if (res.rows.length == 0) {
      return null;
    }
    return res.rows[0][0];
  }

  async setGoLiveText(twitchUsername, goLiveText) {
    const res = await this.db.query(
      'UPDATE user_data SET "goLiveText" = $1 WHERE "twitchId" = $2',
      { params: [goLiveText, twitchUsername] });
    return res;
  }

  async updateRefreshToken(twitchUsername, platform, refreshToken) {
    const connections = await this.getUserConnections(twitchUsername);
    for (let i = 0; i < connections.length; i++) {
      if (connections[i].platform == platform) {
        connections[i].refreshToken = refreshToken;
      }
    }
    return await this.setUserConnections(twitchUsername, connections);
  }

  async addImages(twitchUsername, imageData) {
    const statement = await this.db.prepare( 
        'INSERT INTO user_images ("id", "twitchId", "url", "altText") VALUES ($1, $2, $3, $4)', {
        paramTypes: [DataTypeOIDs.Varchar, DataTypeOIDs.Varchar, DataTypeOIDs.Varchar, DataTypeOIDs.Varchar]
      });
  
    for (let i = 0; i < imageData.length; i++) {
      await statement.execute({params: [nanoid(), twitchUsername, imageData[i].url, imageData[i].altText]});
    }
    await statement.close();
  }

  async updateImages(twitchUsername, imageData) {
    const statement = await this.db.prepare( 
        'UPDATE user_images SET "url" = $1, "altText" = $2 WHERE "twitchId" = $3 AND "id" = $4', {
        paramTypes: [DataTypeOIDs.Varchar, DataTypeOIDs.Varchar, DataTypeOIDs.Varchar, DataTypeOIDs.Varchar]
      });
    for (let i = 0; i < imageData.length; i++) {
      await statement.execute({params: [imageData[i].url, imageData[i].altText, twitchUsername, imageData[i].id]});
    }
    await statement.close();
  }

  async getImages(twitchUsername) {
    const res = await this.db.query(
      'SELECT id, url, "altText" FROM user_images WHERE "twitchId" = $1',
      { params: [twitchUsername] });
    return res.rows.map(row => {
      return {
        "id": row[0],
        "url": row[1],
        "altText": row[2]
      }
    });
  }

  async getRandomImage(twitchUsername) {
    const res = await this.db.query(
      'SELECT id, url, "altText" FROM user_images WHERE "twitchId" = $1 ORDER BY RANDOM() LIMIT 1',
      { params: [twitchUsername] });
    if (res.rows && res.rows.length > 0) {
      return {
        "id": res.rows[0][0],
        "url": res.rows[0][1],
        "altText": res.rows[0][2]
      };
    } else {
      return null;
    }
  }

  async removeImage(twitchUsername, id) {
    const res = await this.db.query(
      'DELETE FROM user_images WHERE "twitchId" = $1 AND "id" = $2',
      { params: [twitchUsername, id] });
    return res;
  }

  async removeImages(twitchUsername, imageData) {
    const statement = await this.db.prepare( 
        'DELETE FROM user_images WHERE "twitchId" = $1 AND "id" = $2', {
        paramTypes: [DataTypeOIDs.Varchar, DataTypeOIDs.Varchar]
      });
    for (let i = 0; i < imageData.length; i++) {
      await statement.execute({params: [twitchUsername, imageData[i].id]});
    }
    await statement.close();
  }
}

// TODO: ENCRYPT TOKENS AND STUFF
function encryptConnections() {

}

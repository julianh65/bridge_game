import type * as Party from "partykit/server";

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onConnect(connection: Party.Connection) {
    connection.send(
      JSON.stringify({
        type: "connected",
        roomId: this.room.id
      })
    );
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    if (typeof message === "string") {
      sender.send(
        JSON.stringify({
          type: "echo",
          message
        })
      );
      return;
    }

    sender.send(message);
  }
}

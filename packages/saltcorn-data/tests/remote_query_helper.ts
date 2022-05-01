import db from "../db";
import { sign } from "jsonwebtoken";
import axios from "axios";

declare let global: any;

export const prepareQueryEnviroment = () => {
  // sign() returns '***' in github actions,
  // I'm using an optional env variable as workaround
  const token = process.env.JSON_WEB_TOKEN
    ? process.env.JSON_WEB_TOKEN
    : sign(
        {
          sub: "admin@foo.com",
          role_id: 1,
          iss: "saltcorn@saltcorn",
          aud: "saltcorn-mobile-app",
        },
        db.connectObj.jwt_secret
      );  
  global.window = {
    localStorage: {
      getItem: (item: string) => {
        if (item === "auth_jwt") return token;
        return undefined;
      },
    },
  };
};

export const sendViewToServer = async (view: any) => {
  let copy = JSON.parse(JSON.stringify(view));
  copy.id = undefined;
  const url = `http://localhost:3000/viewedit/test/inserter`;
  const token = global.window.localStorage.getItem("auth_jwt");
  await axios.post(url, copy, {
    headers: {
      Authorization: `jwt ${token}`,
      "X-Requested-With": "XMLHttpRequest",
      "X-Saltcorn-Client": "mobile-app",
    },
  });
};

export const deleteViewFromServer = async (id: number) => {
  const url = `http://localhost:3000/viewedit/delete/${id}`;
  const token = global.window.localStorage.getItem("auth_jwt");
  await axios.post(
    url,
    {},
    {
      headers: {
        Authorization: `jwt ${token}`,
        "X-Requested-With": "XMLHttpRequest",
        "X-Saltcorn-Client": "mobile-app",
      },
    }
  );
};

import { LogLevel } from "./types";

export abstract class Logger {
  public static log = (logLevel = LogLevel.INFO, msg: string) => {
    let date = new Date().toISOString()
    console.log(`${date} ${logLevel} ${msg}`);
  };
}

export default Logger
export abstract class Logger {
  public static log = (msg: string) => {
    console.log(new Date().toISOString() + ' ' + msg);
  };
}

export default Logger
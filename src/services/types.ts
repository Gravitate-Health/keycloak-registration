import {AxiosRequestConfig} from 'axios'

interface RetryConfig extends AxiosRequestConfig {
  retry: number;
  retryDelay: number;
}

enum LogLevel {
  ALERT = "ALERT",
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
}

export {
    RetryConfig, LogLevel
}
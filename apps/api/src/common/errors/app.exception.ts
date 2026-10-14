// The error type lives in the shared engine so the app can throw/handle the same codes; this alias
// keeps the API's existing imports working.
export {
  AppError as AppException,
  type AppErrorOptions as AppExceptionOptions,
} from '@finance/shared';

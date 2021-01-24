class AppError extends Error {
  // Inherit from built-in Error
  constructor(message, statusCode) {
    super(message); // message only built-in parameter Error accepts

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor); // current object and AppError class as parameters
  }
}

module.exports = AppError;

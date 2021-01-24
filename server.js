const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Globally dealing with uncaught exceptions -- synchronous code
process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  console.log('Uncaught exception!. Shutting down..');
  process.exit(1); // shutdown application
});

dotenv.config({ path: './config.env' }); // read variables and save them as environment variables
const app = require('./app');

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

// connect to database
mongoose
  .connect(DB, {
    // connect() returns a promise
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true, // Dealing with deprication warnings
  })
  .then(() => console.log('DB connection successful!'))
  .catch((error) => console.log(error));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}`);
});

// Globally dealing with unhandled rejections
process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('Unhandled rejection!. Shutting down..');
  server.close(() => {
    process.exit(1); // shutdown application
  });
});

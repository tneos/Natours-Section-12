// Catch async function errors
module.exports = (fn) => {
  return (req, res, next) => {
    // function to be assigned to createTour()
    fn(req, res, next).catch((err) => next(err)); // Pass the error to next()
  };
};

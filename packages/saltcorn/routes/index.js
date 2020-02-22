const table = require('./tables')

module.exports = app => {
  app.use('/table', table)
}
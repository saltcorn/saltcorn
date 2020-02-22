const express = require("express");
const mountRoutes = require("./routes");

const port = 3000;

const app = express();
app.use(express.urlencoded({extended: true}))

mountRoutes(app);

app.get("/", (req, res) => res.send("Hello World!"));

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
});

const mongoose = require("mongoose");

mongoose
    .connect(process.env.DB_URL || 'mongodb://localhost:27017/musicSocial', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('DB connection successful'))
    .catch((err) => console.log(`db connection error : ${err}`));
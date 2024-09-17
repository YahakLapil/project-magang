const express = require("express")
const mysql = require("mysql")
const bcrypt = require("bcrypt")

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs")
app.set("views", "views")

const db = mysql.createConnection({
    host: "localhost",
    database: "mhs_magang",
    user: "root",
    password: "",
})

db.connect((err) => {
    if (err) throw err
    console.log('database connected...')

    const sql = "SELECT * FROM akun"
    db.query(sql, (err, result) => {
        const users = JSON.parse(JSON.stringify(result))
        console.log("hasil database -> ", users)
        app.get("/", (req, res) => {
            res.render("index", { akun: users})
        })
    })

    // login page
    app.post("/login", (req, res) => {
      const username = req.body.username;
      const password = req.body.password;
    
      db.query("SELECT * FROM akun WHERE username = ?", [username], (err, results) => {
        if (err) {
          console.log(err);
        } else {
          console.log(results);
          if (results.length > 0) {
            const hashedPassword = results[0].password;
            bcrypt.compare(password, hashedPassword, (err, isMatch) => {
              if (err) {
                console.log(err);
              } else if (isMatch) {
                console.log("Login successful!");
                res.render("main");
              } else {
                console.log("Invalid username or password.");
                res.render("index", { error: "Invalid username or password." });
              }
            });
          } else {
            console.log("Invalid username or password.");
            res.render("index", { error: "Invalid username or password." });
          }
        }
      });
    });
})

app.listen(3000, () => {
    console.log("Server Siap...")
})
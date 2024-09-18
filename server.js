// deklarasi variabel
const express = require("express")
const mysql = require("mysql")
const bcrypt = require("bcrypt")
const BodyParser = require("body-parser")
const app = express();

// use exvpress dan bodyparser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(BodyParser.urlencoded({ extended: true }))

// set template engine
app.set("view engine", "ejs")
app.set("views", "views")

// setup koneksi
const db = mysql.createConnection({
    host: "localhost",
    database: "mhs_magang",
    user: "root",
    password: "",
})

// koneksi ke database
db.connect((err) => {
    if (err) throw err
    console.log('database connected...')

    
    // Read database
    app.get("/main", (req, res) => {
      const sql = "SELECT * FROM user"
      db.query(sql, (err, result) => {
        const users = JSON.parse(JSON.stringify(result))
        res.render("main", {users: users, title: "DAFTAR MAHASISWA MAGANG" })
      })
    })
    
    // Insert database
    app.post("/tambah", (req, res) => {
      const insertSql = `INSERT INTO user (nama, kelas) VALUES ('${req.body.nama}', '${req.body.kelas}');`
      db.query(insertSql, (err, result) => {
        if (err) throw err
        res.redirect("/main");
      })
    })
    
    // Update database
    app.post("/update/:id", (req, res) => {
      const updateSql = "UPDATE user SET ? WHERE id = ?"
      const data = {
        nama: req.body.nama,
        kelas: req.body.kelas,
      }
      const id = req.params.id
      db.query(updateSql, [data, id], (err, result) => {
        if (err) throw err
        res.redirect("/main");
      })
    })
    
    // Delete database
    app.get("/delete/:id", (req, res) => {
      const deleteSql = "DELETE FROM user WHERE id = ?"
      const id = req.params.id
      db.query(deleteSql, id, (err, result) => {
        if (err) throw err
        res.redirect("/main");
      })
    })
    
    // Get user by id
    app.get("/edit/:id", (req, res) => {
      const sql = "SELECT * FROM user WHERE id = ?"
      const id = req.params.id
      db.query(sql, id, (err, result) => {
        if (err) throw err
          const userData = JSON.parse(JSON.stringify(result))[0];
          res.render("edit", { userData: userData, judul: "EDIT MAHASISWA MAGANG" })
      })
    })

    // tangkap data
    const sql = "SELECT * FROM akun"
    db.query(sql, (err, result) => {
        const users = JSON.parse(JSON.stringify(result))
        console.log("hasil database -> ", users)
        app.get("/", (req, res) => {
            res.render("login", { akun: users})
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
                const sql = "SELECT * FROM user"
                db.query(sql, (err, result) => {
                  const users = JSON.parse(JSON.stringify(result))
                  res.render("main", {users: users, title: "DAFTAR MAHASISWA MAGANG" })
                })
              } else {
                console.log("Invalid username or password.");
                res.render("login", { error: "Invalid username or password." });
              }
            });
          } else {
            console.log("Invalid username or password.");
            res.render("login", { error: "Invalid username or password." });
          }
        }
      });
    });
  })

// buat localhost 3000
app.listen(3000, () => {
    console.log("Server Siap...")
})
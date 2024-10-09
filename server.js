// deklarasi variabel
const express = require("express")
const mysql = require("mysql")
const bcrypt = require("bcrypt")
const BodyParser = require("body-parser")
const multer = require("multer")
const moment = require("moment")
const app = express()
const upload = multer({ dest: "./uploads/" })

// use express dan bodyparser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(BodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use('/uploads', express.static('uploads'))


//membuat library moment tersedia di file edit
app.locals.moment = require('moment')

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

    // data mahasiswa
    app.get("/data-mhs", async (req, res) => {
      try {
        const sqlAkun = "SELECT * FROM akun"
        const sqlUser  = "SELECT * FROM user"

        db.query(sqlAkun, (err, akunResults) => {
          if (err) throw err
          const akunResult = JSON.parse(JSON.stringify(akunResults))
            db.query(sqlUser , (err, userResults) => {
              if (err) throw err
                const userResult = JSON.parse(JSON.stringify(userResults))
                userResult.forEach((user) => {
                  user.mulai = moment(user.mulai).format("YYYY-MM-DD")
                  user.akhir = moment(user.akhir).format("YYYY-MM-DD")
                })
                console.log("hasil data -> ", userResult, akunResult)
                res.render("data-mhs", { akun: akunResult, users: userResult, title: "DAFTAR MAHASISWA MAGANG" })
            })
        })
      } catch (err) {
        console.error(err)
        res.status(500).send("An error occurred")
      }
    });

    // Insert database
    app.post("/tambah", upload.any(), (req, res) => {
      const insertSql = "INSERT INTO user (nama, univ, nim, mulai, akhir, foto) VALUES (?, ?, ?, ?, ?, ?)"
      const filename = req.files[0].filename
      const filepath = `./uploads/${filename}`

      db.query(insertSql, [req.body.nama, req.body.univ, req.body.nim, req.body.mulai, req.body.akhir, filename], (err, result) => {
        if (err) throw err
        res.redirect("/data-mhs")
      })
    })

    // Tambahkan route untuk mengembalikan gambar BLOB
    app.get("/gambar/:id", (req, res) => {
      const id = req.params.id
      const sql = "SELECT foto FROM user WHERE id = ?"

      db.query(sql, id, (err, result) => {
        if (err) throw err
        const gambar = result[0].foto
        const fs = require('fs')
        const filePath = `./uploads/${gambar}`
        fs.readFile(filePath, (err, data) => {
          if (err) throw err
          res.set("Content-Type", "image/jpeg")
          res.send(data)
        })
      })
    })

    // Update database
    app.post("/update/:id", upload.single('newFilename'), (req, res) => {
      const updateSql = "UPDATE user SET nama = ?, univ = ?, nim = ?, mulai = ?, akhir = ?, foto = ? WHERE id = ?"
      const data = {
        nama: req.body.nama,
        univ: req.body.univ,
        nim: req.body.nim,
        mulai: req.body.mulai,
        akhir: req.body.akhir,
      }
      const id = req.params.id
      const sql = "SELECT foto FROM user WHERE id = ?"
      db.query(sql, id, (err, result) => {
        if (err) throw err
        const userData = result[0]
        if (req.file) {
          data.foto = req.file.filename
          db.query(updateSql, [data.nama, data.univ, data.nim, data.mulai, data.akhir, data.foto, id], (err, result) => {
            if (err) throw err
            // Hapus foto lama
            const fs = require('fs')
            const filePath = `./uploads/${userData.foto}`
            fs.unlink(filePath, (err) => {
              if (err) throw err
              console.log('Foto lama telah dihapus')
            })
            res.redirect("/data-mhs")
          })
        } else {
          db.query("UPDATE user SET nama = ?, univ = ?, nim = ?, mulai = ?, akhir = ? WHERE id = ?", [data.nama, data.univ, data.nim, data.mulai, data.akhir, id], (err, result) => {
            if (err) throw err
            res.redirect("/data-mhs")
          })
        }
      })
    })

    // Delete database
    app.get("/delete/:id", (req, res) => {
      const deleteSql = "DELETE FROM user WHERE id = ?"
      const id = req.params.id
      db.query(deleteSql, id, (err, result) => {
        if (err) throw err
        res.redirect("/data-mhs")
      })
    })

    // Get user by id
    app.get("/edit/:id", (req, res) => {
      const sql = "SELECT * FROM user WHERE id = ?"
      const id = req.params.id
      db.query(sql, id, (err, result) => {
        if (err) throw err
        const userData = result[0]
        res.render("edit", { userData: userData, judul: "EDIT MAHASISWA MAGANG" })
      })
    })

    // tangkap data
    app.get("/", (req, res) => {
      const sql = "SELECT * FROM akun"
      db.query(sql, (err, result) => {
        if (err) throw err
        const hasil = JSON.parse(JSON.stringify(result))
        console.log("hasil -> ", hasil)
        res.render("login", { akun: hasil})
      })
    })
  
    // login page
    app.post("/login", (req, res) => {
      const username = req.body.username;
      const password = req.body.password;
    
      db.query("SELECT * FROM akun WHERE username = ?", [username], (err, results) => {
        if (err) {
        } else {
          if (results.length > 0) {
            const hashedPassword = results[0].password
            bcrypt.compare(password, hashedPassword, (err, isMatch) => {
              if (err) {
                console.log(err)
              } else if (isMatch) {
                const sql = "SELECT * FROM akun"
                db.query(sql, (err, result) => {
                  const Akun = JSON.parse(JSON.stringify(result))
                  res.render("dashboard", {akun: Akun})
                })
              } else {
                console.log("Invalid username or password.")
                res.render("login", { error: "Invalid username or password." })
              }
            })
          } else {
            console.log("Invalid username or password.")
            res.render("login", { error: "Invalid username or password." })
          }
        }
      })
    })

    // dashboard
    app.get("/dashboard", (req, res) => {
      const sql = "SELECT * FROM akun"
      db.query(sql, (err, result) => {
        if (err) throw err
        const akun = JSON.parse(JSON.stringify(result))
        res.render("dashboard", { akun: akun })
      })
    })

    // tambah
    app.get("/tambah", (req, res) => {
      if (err) throw err
      res.render("tambah")
    })
  })

// buat localhost 3000
app.listen(3000, () => {
    console.log("Server Siap...")
})
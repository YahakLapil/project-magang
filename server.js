// deklarasi variabel
const express = require("express")
const mysql = require("mysql")
const bcrypt = require("bcrypt")
const BodyParser = require("body-parser")
const multer = require("multer")
const moment = require("moment")
const app = express()
const upload = multer({ dest: "./uploads/" })
const session = require("express-session")

// use express dan bodyparser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(BodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use('/uploads', express.static('uploads'))
app.use(session({secret: "secret", resave: false, saveUninitialized: true, cookie: { secure: false } }))


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
      if (!req.session.username) {
        res.redirect("/login")
      } else {
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
                res.render("data-mhs", { akun: akunResult, users: userResult, title: "DAFTAR MAHASISWA MAGANG", username: req.session.username })
            })
        })
      }
    })

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

    // tangkap data mahasiswa dan admin
    app.get("/", (req, res) => {
      const akunSql = "SELECT * FROM akun";
      const mahasiswaSql = "SELECT * FROM mahasiswa";
    
      db.query(akunSql, (err, akunResults) => {
        if (err) throw err;
        const akunData = JSON.parse(JSON.stringify(akunResults));
        console.log("Hasil akun -> ", akunData)
    
        db.query(mahasiswaSql, (err, mahasiswaResults) => {
          if (err) throw err;
          const mahasiswaData = JSON.parse(JSON.stringify(mahasiswaResults));
          console.log("Hasil mahasiswa -> ", mahasiswaData)
    
          res.render("login", { akun: akunData, mahasiswa: mahasiswaData });
        });
      });
    });
  
    // login page
    app.post("/login", (req, res) => {
      const username = req.body.username;
      const password = req.body.password;

      // Cari username di database admin dan mahasiswa
      db.query("SELECT * FROM akun WHERE username = ?", [username], (err, adminResults) => {
        if (err) {
          console.log(err);
        } else if (adminResults.length > 0) {
          // Jika username ditemukan di database admin
          const hashedPassword = adminResults[0].password;
          bcrypt.compare(password, hashedPassword, (err, isMatch) => {
            if (err) {
              console.log(err);
            } else if (isMatch) {
              // Jika password cocok, render dashboard admin
              req.session.username = username
              const sql = "SELECT * FROM akun";
              db.query(sql, (err, result) => {
                const Akun = JSON.parse(JSON.stringify(result));
                res.render("dashboard", { akun: Akun, username: username });
              });
            } else {
              // Jika password tidak cocok, render error
              console.log("Invalid username or password.");
              res.render("login", { error: "Invalid username or password." });
            }
          });
        } else {
          // Jika username tidak ditemukan di database admin, cari di database mahasiswa
          db.query("SELECT * FROM mahasiswa WHERE username = ?", [username], (err, mahasiswaResults) => {
            if (err) {
              console.log(err);
            } else if (mahasiswaResults.length > 0) {
              // Jika username ditemukan di database mahasiswa
              const hashedPassword = mahasiswaResults[0].password;
              bcrypt.compare(password, hashedPassword, (err, isMatch) => {
                if (err) {
                  console.log(err);
                } else if (isMatch) {
                  // Jika password cocok, redirect dashboard mahasiswa
                  req.session.username = username
                  const sql = "SELECT * FROM mahasiswa"
                  db.query(sql, (err, result) => {
                    const mahasiswa = JSON.parse(JSON.stringify(result))
                    res.render("mahasiswa", {mahasiswa: mahasiswa, username: username})
                  })
                } else {
                  // Jika password tidak cocok, render error
                  console.log("Invalid username or password.");
                  res.render("login", { error: "Invalid username or password." });
                }
              });
            } else {
              // Jika username tidak ditemukan di database mahasiswa, render error
              console.log("Invalid username or password.");
              res.render("login", { error: "Invalid username or password." });
            }
          });
        }
      });
    });

    // dashboard
    app.get("/dashboard", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM akun"
        db.query(sql, (err, result) => {
          if (err) throw err
          const akun = JSON.parse(JSON.stringify(result))
          res.render("dashboard", { akun: akun, username: req.session.username })
        })
      }
    })

    // mahasiswa
    app.get("/mahasiswa", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM mahasiswa"
        db.query(sql, (err, result) => {
          if (err) throw err
          const mahasiswa = JSON.parse(JSON.stringify(result))
          res.render("mahasiswa", { mahasiswa: mahasiswa, username: req.session.username })
        })
      }
    })

    // tambah
    app.get("/tambah", (req, res) => {
      if (err) throw err
      res.render("tambah")
    })

    // detail
    app.get("/detail/:id", (req, res) => {
      const id = req.params.id
      const sql = "SELECT * FROM user WHERE id = ?"
      db.query(sql, id, (err, result) => {
        if (err) throw err
        const userData = result[0]
        res.render("detail", { userData: userData })
      })
    })

    // akun mahasiswa
    app.get("/akun-mhs", (req, res) => {
      if (err) throw err
      res.render("akun-mhs")
    })

    // tambah akun mahasiswa
    app.post("/tambah-akun", (req, res) => {
      const username = req.body.username
      const password = req.body.password

      const sql = "SELECT * FROM mahasiswa WHERE username = ?"
      db.query(sql, [username], (err, result) => {
        if (err) {
          console.error(err)
          res.status(500).send("Error creating account")
        } else if (result.length > 0) {
          res.render("akun-mhs", { error: "Username sudah ada"})
        } else {
          bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
              console.error(err)
              res.status(500).send("Error creating account")
            } else {
              const sql = "INSERT INTO mahasiswa (username, password) VALUES (?, ?)"
              db.query(sql, [username, hashedPassword], (err, result) => {
                if (err) {
                  console.error(err)
                  res.status(500).send("Error creating account")
                } else {
                  res.redirect("/data-mhs")
                }
              })
            }
          })
        }
      })
    })

    // data absen
    app.get("/data-absen", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM akun"
        db.query(sql, (err, result) => {
          if (err) throw err
          const akun = JSON.parse(JSON.stringify(result))
          res.render("data-absen", { akun: akun, username: req.session.username })
        })
      }
    })

    // data kegiatan
    app.get("/data-kegiatan", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM akun"
        db.query(sql, (err, result) => {
          if (err) throw err
          const akun = JSON.parse(JSON.stringify(result))
          res.render("data-kegiatan", { akun: akun, username: req.session.username })
        })
      }
    })

    // administrator
    app.get("/administrator", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM akun"
        db.query(sql, (err, result) => {
          if (err) throw err
          const akun = JSON.parse(JSON.stringify(result))
          res.render("administrator", { akun: akun, username: req.session.username })
        })
      }
    })
    
    // pengaturan
    app.get("/pengaturan", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM akun"
        db.query(sql, (err, result) => {
          if (err) throw err
          const akun = JSON.parse(JSON.stringify(result))
          res.render("pengaturan", { akun: akun, username: req.session.username })
        })
      }
    })

    // mahasiswa
    app.get("/mahasiswa", (req, res) => {
      const sql = "SELECT * FROM mahasiswa"
      db.query(sql, (err, result) => {
        if (err) throw err
        const akun = JSON.parse(JSON.stringify(result))
        res.render("mahasiswa", { akun: akun })
      })
    })

    // absensi
    app.get("/absensi", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM mahasiswa"
        db.query(sql, (err, result) => {
          if (err) throw err
          const mahasiswa = JSON.parse(JSON.stringify(result))
          res.render("absensi", { mahasiswa: mahasiswa, username: req.session.username })
        })
      }
    })

    // riwayat absen
    app.get("/riwayat-absen", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM mahasiswa"
        db.query(sql, (err, result) => {
          if (err) throw err
          const mahasiswa = JSON.parse(JSON.stringify(result))
          res.render("riwayat-absen", { mahasiswa: mahasiswa, username: req.session.username })
        })
      }
    })

    // kegiatan
    app.get("/kegiatan", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM mahasiswa"
        db.query(sql, (err, result) => {
          if (err) throw err
          const mahasiswa = JSON.parse(JSON.stringify(result))
          res.render("kegiatan", { mahasiswa: mahasiswa, username: req.session.username })
        })
      }
    })

    // profil
    app.get("/profil", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM mahasiswa"
        db.query(sql, (err, result) => {
          if (err) throw err
          const mahasiswa = JSON.parse(JSON.stringify(result))
          res.render("profil", { mahasiswa: mahasiswa, username: req.session.username })
        })
      }
    })

    // tambah absen
    app.get("/tambah-absen", (req, res) => {
      if (err) throw err
      res.render("tambah-absen")
    })

    // tambah kegiatan
    app.get("/tambah-kegiatan", (req, res) => {
      if (err) throw err
      res.render("tambah-kegiatan")
    })

    // tambah admin
    app.get("/tambah-admin", (req, res) => {
      if (err) throw err
      res.render("tambah-admin")
    })

  })

// buat localhost 3000
app.listen(3000, () => {
    console.log("Server Siap...")
})
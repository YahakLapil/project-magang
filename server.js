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

    // Insert database user
    app.post("/tambah", upload.any(), (req, res) => {
      const insertSql = "INSERT INTO user (nama, univ, nim, mulai, akhir, foto) VALUES (?, ?, ?, ?, ?, ?)"
      const filename = req.files[0].filename
      const filepath = `./uploads/${filename}`

      db.query(insertSql, [req.body.nama, req.body.univ, req.body.nim, req.body.mulai, req.body.akhir, filename], (err, result) => {
        if (err) throw err
        res.redirect("/data-mhs")
      })
    })

    // Insert database kegiatan
    app.post("/tambah-kegiatan-mhs", (req, res) => {
      const { awal, akhir, kegiatan, id_mahasiswa } = req.body

      const tanggal = moment().format("YYYY-MM-DD")
      const hari = moment().format("dddd")
      const jam = `${awal} - ${akhir}`

      let hariIndo
      switch (hari) {
        case "Monday":
          hariIndo = "Senin"
          break
        case "Tuesday":
          hariIndo = "Selasa"
          break
        case "Wednesday":
          hariIndo = "Rabu"
          break
        case "Thursday":
          hariIndo = "Kamis"
          break
        case "Friday":
          hariIndo = "Jumat"
          break
        case "Saturday":
          hariIndo = "Sabtu"
          break
        case "Sunday":
          hariIndo = "Minggu"
          break
        default:
          hariIndo = hari
      }

      const sqlCek = "SELECT * FROM kegiatan WHERE tanggal = ? AND id_mahasiswa = ?"
      db.query(sqlCek, [tanggal, id_mahasiswa], (err, result) => {
        if (err) throw err
        if (result.length > 0) {
          const sqlUpdate = "UPDATE kegiatan SET jam = CONCAT_WS(', ', jam, ?), kegiatan = CONCAT_WS(', ', kegiatan, ?) WHERE tanggal = ? AND id_mahasiswa = ?"
          db.query(sqlUpdate, [jam, kegiatan, tanggal, id_mahasiswa], (err, result) => {
            if (err) throw err
            res.redirect("/kegiatan")
          })
        } else {
          const insertSql = "INSERT INTO kegiatan (hari, tanggal, jam, kegiatan, id_mahasiswa) VALUES (?, ?, ?, ?, ?)"
          db.query(insertSql, [hariIndo, tanggal, jam, kegiatan, id_mahasiswa], (err, result) => {
            if (err) throw err
            res.redirect("/kegiatan")
          })
        }
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

    // Update database user
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

    //Update database administrator
    app.post("/update-admin/:id", (req, res) => {
      const updateSql = "UPDATE administrator SET nama = ?, nip = ?, email = ? WHERE id = ?"
      const data = {
        nama: req.body.nama,
        nip: req.body.nip,
        email: req.body.email,
      }
      const id = req.params.id
      db.query(updateSql, [data.nama, data.nip, data.email, id], (err, result) => {
        if (err) throw err
        res.redirect("/administrator")
      })
    })

    // Delete database user
    app.get("/delete/:id", (req, res) => {
      const deleteSql = "DELETE FROM user WHERE id = ?"
      const id = req.params.id
      db.query(deleteSql, id, (err, result) => {
        if (err) throw err
        res.redirect("/data-mhs")
      })
    })

    // Delete database administrator
    app.get("/delete-admin/:id", (req, res) => {
      const deleteSql = "DELETE FROM administrator WHERE id = ?"
      const id = req.params.id
      db.query(deleteSql, id, (err, result) => {
        if (err) throw err
        res.redirect("/administrator")
      })
    })

    // Get user by id user
    app.get("/edit/:id", (req, res) => {
      const sql = "SELECT * FROM user WHERE id = ?"
      const id = req.params.id
      db.query(sql, id, (err, result) => {
        if (err) throw err
        const userData = result[0]
        res.render("edit", { userData: userData, judul: "EDIT MAHASISWA MAGANG" })
      })
    })
    
    // Get administrator by id administrator
    app.get("/edit-admin/:id", (req, res) => {
      const sql = "SELECT * FROM administrator WHERE id = ?"
      const id = req.params.id
      db.query(sql, id, (err, result) => {
        if (err) throw err
        const userData = result[0]
        res.render("edit-admin", { userData: userData, judul: "EDIT MAHASISWA MAGANG" })
      })
    })

    // tangkap data mahasiswa dan admin
    app.get("/", (req, res) => {
      const sql = "SELECT * FROM akun"
      db.query(sql, (err, result) => {
        if (err) throw err
        const akun = JSON.parse(JSON.stringify(result))
        res.render("login", { akun: akun })
      })
    })
  
    // login page
    app.post("/login", (req, res) => {
      const username = req.body.username
      const password = req.body.password

      // Cari username di database akun
      db.query("SELECT * FROM akun WHERE username = ?", [username], (err, results) => {
        if (err) {
          console.log(err)
        } else if (results.length > 0) {
          // Jika username ditemukan di database akun
          const hashedPassword = results[0].password
          const role = results[0].role // tambahkan ini untuk mengecek role
          const id_mahasiswa = results[0].id // tambahkan ini untuk mendapatkan ID mahasiswa
          bcrypt.compare(password, hashedPassword, (err, isMatch) => {
            if (err) {
              console.log(err)
            } else if (isMatch) {
              // Jika password cocok, render dashboard berdasarkan role
              req.session.username = username
              req.session.id_mahasiswa = id_mahasiswa // tambahkan ini untuk menyimpan ID mahasiswa pada session
              if (role === 'admin') {
                const sql = "SELECT * FROM akun"
                db.query(sql, (err, result) => {
                  const Akun = JSON.parse(JSON.stringify(result))
                  res.render("dashboard", { akun: Akun, username: username })
                })
              } else if (role === 'mahasiswa') {
                const sql = "SELECT * FROM akun"
                db.query(sql, (err, result) => {
                  const mahasiswa = JSON.parse(JSON.stringify(result))
                  res.render("mahasiswa", { mahasiswa: mahasiswa, username: username })
                })
              }
            } else {
              // Jika password tidak cocok, render error
              console.log("Invalid username or password.")
              res.render("login", { error: "Invalid username or password." })
            }
          })
        } else {
          // Jika username tidak ditemukan di database akun, render error
          console.log("Invalid username or password.")
          res.render("login", { error: "Invalid username or password." })
        }
      })
    })

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
        const sql = "SELECT * FROM akun"
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
      res.render("akun-mhs", { accountCreated: req.session.accountCreated })
    })

    // Route to show the create account page for a specific user
    app.get("/akun-mhs/:id", (req, res) => {
      const userId = req.params.id // Get the user ID from the URL
      const sql = "SELECT * FROM akun WHERE id = ?" // Assuming user_id is the foreign key in akun table

      db.query(sql, [userId], (err, result) => {
        if (err) throw err

        // Check if an account exists for the user ID
        if (result.length > 0) {
          req.session.accountCreated = true // Set session variable if account exists
        } else {
          req.session.accountCreated = false // Set session variable if account does not exist
        }

        // Render the account creation page
        res.render("akun-mhs", { accountCreated: req.session.accountCreated })
      })
    })

    // Route to show the create account page for a specific user
    app.get("/akun-admin/:id", (req, res) => {
      const adminId = req.params.id // Get the user ID from the URL
      const sql = "SELECT * FROM akun WHERE id = ?" // Assuming user_id is the foreign key in akun table
      console.log("adminId = ", adminId)

      db.query(sql, [adminId], (err, result) => {
        if (err) throw err

        // Check if an account exists for the user ID
        if (result.length > 0) {
          req.session.accountCreated = true // Set session variable if account exists
        } else {
          req.session.accountCreated = false // Set session variable if account does not exist
        }

        // Render the account creation page
        res.render("akun-admin", { accountCreated: req.session.accountCreated, adminId: adminId })
      })
    })

    // Route to handle admin account creation
    app.post("/tambah-akun", (req, res) => {
      const username = req.body.username
      const password = req.body.password
      const role = req.body.role

      // Check if an account already exists for the selected username
      const sqlCheck = "SELECT * FROM akun WHERE username = ?"
      db.query(sqlCheck, [username], (err, result) => {
        if (err) {
          console.error(err)
          return res.status(500).send("Error checking account")
        }

        if (result.length > 0) {
          // Account already exists
          return res.render("akun-admin", { error: "Username sudah ada", accountCreated: req.session.accountCreated })
        }

        let userId = null
        let adminId = null

        if (role === "mahasiswa") {
          // Get mahasiswa id from user table
          const sqlUserId = "SELECT id FROM user WHERE id NOT IN (SELECT user_id FROM akun WHERE user_id IS NOT NULL) LIMIT 1"
          db.query(sqlUserId, (err, userResult) => {
            if (err) {
              console.error(err)
              return res.status(500).send("Error inserting account")
            }

            userId = userResult.length > 0 ? userResult[0].id : null

            if (!userId) {
              return res.render("akun-mhs", { error: "Tidak ada ID mahasiswa yang tersedia", accountCreated: false })
            }

            bcrypt.hash(password, 10, (err, hashedPassword) => {
              if (err) throw err
              const sqlInsert = "INSERT INTO akun (user_id, admin_id, username, password, role) VALUES (?, ?, ?, ?, ?)"
              db.query(sqlInsert, [userId, adminId, username, hashedPassword, role], (err, result) => {
                if (err) throw err
                res.redirect("/data-mhs") // Redirect setelah berhasil menambah akun
              })
            })
          })
        } else if (role === "admin") {
          // Get admin id from administrator table
          const sqlAdminId = "SELECT id FROM administrator WHERE id NOT IN (SELECT admin_id FROM akun WHERE admin_id IS NOT NULL) LIMIT 1"
          db.query(sqlAdminId, (err, adminResult) => {
            if (err) {
              console.error(err)
              return res.status(500).send("Error inserting account")
            }
            adminId = adminResult.length > 0 ? adminResult[0].id : null

            if (!adminId) {
              return res.render("akun-admin", { error: "Tidak ada ID administrator yang tersedia", accountCreated: false })
            }

            bcrypt.hash(password, 10, (err, hashedPassword) => {
              if (err) throw err
              const sqlInsert = "INSERT INTO akun (user_id, admin_id, username, password, role) VALUES (?, ?, ?, ?, ?)"
              db.query(sqlInsert, [userId, adminId, username, hashedPassword, role], (err, result) => {
                if (err) throw err
                res.redirect("/administrator") // Redirect setelah berhasil menambah akun
              })
            })
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
        const sql = "SELECT k.id, k.hari, k.tanggal, k.jam, k.kegiatan, a.username FROM kegiatan k INNER JOIN akun a ON k.id_mahasiswa = a.id"

        db.query(sql, (err, result) => {
          if (err) throw err
          const kegiatanData = JSON.parse(JSON.stringify(result))
          console.log("Hasil kegiatan -> ", kegiatanData)

          res.render("data-kegiatan", { kegiatan: kegiatanData, username: req.session.username })
        })
      }
    })

    // Edit data kegiatan
    app.get("/edit-kegiatan/:id", (req, res) => {
      const id = req.params.id
      const sql = "SELECT * FROM kegiatan WHERE id = ?"

      db.query(sql, id, (err, result) => {
        if (err) throw err
        const kegiatanData = result[0]
        res.render("edit-kegiatan", { kegiatanData: kegiatanData, username: req.session.username })
      })
    })

    // Update data kegiatan
    app.post("/update-kegiatan/:id", (req, res) => {
      const id = req.params.id
      const { hari, tanggal } = req.body
      const jamArray = []
      const kegiatanArray = []

      // Ambil semua jam dan kegiatan dari req.body
      let i = 1
      while (req.body[`jam-${i}`]) { // Asumsikan jam diinputkan dengan format jam-1, jam-2, ...
          jamArray.push(req.body[`jam-${i}`])
          kegiatanArray.push(req.body[`kegiatan-${i}`])
          i++
      }

      const jam = jamArray.join(', ')
      const kegiatan = kegiatanArray.join(', ')

      const sql = "UPDATE kegiatan SET hari = ?, tanggal = ?, jam = ?, kegiatan = ? WHERE id = ?"
      db.query(sql, [hari, tanggal, jam, kegiatan, id], (err, result) => {
          if (err) throw err
          res.redirect("/data-kegiatan")
      })
    })

    // Hapus data kegiatan
    app.get("/hapus-kegiatan/:id", (req, res) => {
      const id = req.params.id
      const sql = "DELETE FROM kegiatan WHERE id = ?"

      db.query(sql, id, (err, result) => {
        if (err) throw err
        res.redirect("/data-kegiatan")
      })
    })

    // administrator
    app.get("/administrator", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const akunSql = "SELECT * FROM akun"
        const adminSql = "SELECT * FROM administrator"
      
        db.query(akunSql, (err, akunResults) => {
          if (err) throw err
          const akunData = JSON.parse(JSON.stringify(akunResults))
          console.log("Hasil akun -> ", akunData)
      
          db.query(adminSql, (err, adminResults) => {
            if (err) throw err
            const adminData = JSON.parse(JSON.stringify(adminResults))
            console.log("Hasil admin -> ", adminData)
      
            res.render("administrator", { akun: akunData, admin: adminData, username: req.session.username })
          })
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
      const sql = "SELECT * FROM akun"
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
        const sql = "SELECT * FROM akun"
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
        const sql = "SELECT * FROM akun"
        db.query(sql, (err, result) => {
          if (err) throw err
          const mahasiswa = JSON.parse(JSON.stringify(result))
          res.render("riwayat-absen", { mahasiswa: mahasiswa, username: req.session.username })
        })
      }
    })

    // kegiatan
    app.get("/kegiatan", async (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const akunSql = "SELECT * FROM akun"
        const kegiatanSql = "SELECT * FROM kegiatan WHERE id_mahasiswa = ?"

        db.query(akunSql, (err, akunResults) => {
          if (err) throw err
          const akunData = JSON.parse(JSON.stringify(akunResults))
          console.log("Hasil akun -> ", akunData)

          const id_mahasiswa = req.session.id_mahasiswa // tambahkan ini untuk mendapatkan ID mahasiswa
          db.query(kegiatanSql, id_mahasiswa, (err, kegiatanResults) => {
            if (err) throw err
            const kegiatanData = JSON.parse(JSON.stringify(kegiatanResults))
            kegiatanData.forEach((kegiatan) => {
              kegiatan.mulai = moment(kegiatan.tanggal).format("YYYY-MM-DD")
            })
            console.log("Hasil kegiatan -> ", kegiatanData)

            res.render("kegiatan", { akun: akunData, kegiatan: kegiatanData, username: req.session.username })
          })
        })
      }
    })

    // profil
    app.get("/profil", (req, res) => {
      if (!req.session.username) {
        res.redirect("/login")
      } else {
        const sql = "SELECT * FROM akun"
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
      const sql = "SELECT * FROM akun WHERE role = 'mahasiswa'"
      db.query(sql, (err, result) => {
        if (err) throw err
        const mahasiswa = JSON.parse(JSON.stringify(result))
        res.render("tambah-kegiatan", { mahasiswa: mahasiswa })
      })
    })

    // tambah kegiatan
    app.post("/tambah-kegiatan", (req, res) => {
      const { id_mahasiswa, tanggal, awal, akhir, kegiatan } = req.body

      const tanggalFormat = moment(tanggal).format("YYYY-MM-DD")
      const hari = moment(tanggal).format("dddd")
      const jam = `${awal} - ${akhir}`

      let hariIndo
      switch (hari) {
        case "Monday":
          hariIndo = "Senin"
          break
        case "Tuesday":
          hariIndo = "Selasa"
          break
        case "Wednesday":
          hariIndo = "Rabu"
          break
        case "Thursday":
          hariIndo = "Kamis"
          break
        case "Friday":
          hariIndo = "Jumat"
          break
        case "Saturday":
          hariIndo = "Sabtu"
          break
        case "Sunday":
          hariIndo = "Minggu"
          break
        default:
          hariIndo = hari
      }

      const sqlCek = "SELECT * FROM kegiatan WHERE tanggal = ? AND id_mahasiswa = ?"
      db.query(sqlCek, [tanggalFormat, id_mahasiswa], (err, result) => {
        if (err) throw err
        if (result.length > 0) {
          const sqlUpdate = "UPDATE kegiatan SET hari = ?, jam = CONCAT_WS(', ', jam, ?), kegiatan = CONCAT_WS(', ', kegiatan, ?) WHERE tanggal = ? AND id_mahasiswa = ?"
          db.query(sqlUpdate, [hariIndo, jam, kegiatan, tanggalFormat, id_mahasiswa], (err, result) => {
            if (err) throw err
            res.redirect("/data-kegiatan")
          })
        } else {
          const insertSql = "INSERT INTO kegiatan (hari, tanggal, jam, kegiatan, id_mahasiswa) VALUES (?, ?, ?, ?, ?)"
          db.query(insertSql, [hariIndo, tanggalFormat, jam, kegiatan, id_mahasiswa], (err, result) => {
            if (err) throw err
            res.redirect("/data-kegiatan")
          })
        }
      })
    })

    // tambah admin
    app.get("/tambah-admin", (req, res) => {
      if (err) throw err
      res.render("tambah-admin", { accountCreated: req.session.accountCreated })
    })

    // insert tambah-admin
    app.post("/tambah-adm", (req, res) => {
      const sql = "INSERT INTO administrator (nama, nip, email) VALUES (?, ?, ?)"
      
      db.query(sql, [req.body.nama, req.body.nip, req.body.email], (err, result) => {
        if (err) throw err
        res.redirect("/administrator")
      })
    })

    // mulai absen
    app.get("/mulai-absen", (req, res) => {
      if (err) throw err
      res.render("mulai-absen")
    })

    // absen mhs
    app.get("/absen-mhs", (req, res) => {
      if (err) throw err
      res.render("absen-mhs")
    })

    // Route to show the create account page for admin
    app.get("/akun-admin", (req, res) => {
      res.render("akun-admin", { accountCreated: req.session.accountCreated })
    })
    
    // tambah kegiatan mhs
    app.get("/tambah-kegiatan-mhs", (req, res) => {
      if (err) throw err
      res.render("tambah-kegiatan-mhs", { id_mahasiswa: req.session.id_mahasiswa })
    })

  })

// buat localhost 3000
app.listen(3000, () => {
    console.log("Server Siap...")
})
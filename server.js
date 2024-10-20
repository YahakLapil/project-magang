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
      const insertSql = "INSERT INTO user (nama, univ, jurusan, nim, mulai, akhir, email, telepon, alamat, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      const filename = req.files[0].filename
      const filepath = `./uploads/${filename}`

      db.query(insertSql, [req.body.nama, req.body.univ, req.body.jurusan, req.body.nim, req.body.mulai, req.body.akhir, req.body.email, req.body.telepon, req.body.alamat, filename], (err, result) => {
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
  
    // Halaman login
    app.post("/login", (req, res) => {
      const username = req.body.username;
      const password = req.body.password;

      // Query untuk mencari pengguna di tabel akun
      db.query("SELECT * FROM akun WHERE username = ?", [username], (err, results) => {
          if (err) {
              console.error("Kesalahan pada database:", err);
              return res.render("login", { error: "Kesalahan pada database." });
          }

          if (results.length > 0) {
              const hashedPassword = results[0].password;
              const role = results[0].role;
              const accountId = results[0].user_id;
              const accountsId = results[0].admin_id;
              const id_mahasiswa = results[0].id;

              // Ambil detail pengguna berdasarkan role
              if (role === 'mahasiswa') {
                  // Ambil detail dari tabel user
                  db.query("SELECT * FROM user WHERE id = ?", [accountId], (err, userResults) => {
                      if (err) {
                          console.error("Kesalahan pada database:", err);
                          return res.render("login", { error: "Kesalahan pada database." });
                      }

                      if (userResults.length > 0) {
                          bcrypt.compare(password, hashedPassword, (err, isMatch) => {
                              if (err) {
                                  console.error("Kesalahan saat membandingkan password:", err);
                                  return res.render("login", { error: "Kesalahan saat membandingkan password." });
                              }

                              if (isMatch) {
                                  req.session.id_mahasiswa = id_mahasiswa
                                  req.session.id_mhs = accountId
                                  req.session.username = username;
                                  req.session.userId = userResults[0].id; // Set ID mahasiswa
                                  res.redirect("/mahasiswa");
                              } else {
                                  console.log("Username atau password tidak valid.");
                                  res.render("login", { error: "Username atau password tidak valid." });
                              }
                          });
                      } else {
                          console.log("Pengguna tidak ditemukan.");
                          res.render("login", { error: "Pengguna tidak ditemukan." });
                      }
                  });
              } else if (role === 'admin') {
                  // Ambil detail dari tabel administrator
                  db.query("SELECT * FROM administrator WHERE id = ?", [accountsId], (err, adminResults) => {
                      if (err) {
                          console.error("Kesalahan pada database:", err);
                          return res.render("login", { error: "Kesalahan pada database." });
                      }

                      if (adminResults.length > 0) {
                          bcrypt.compare(password, hashedPassword, (err, isMatch) => {
                              if (err) {
                                  console.error("Kesalahan saat membandingkan password:", err);
                                  return res.render("login", { error: "Kesalahan saat membandingkan password." });
                              }

                              if (isMatch) {
                                  req.session.username = username;
                                  req.session.id_mhs = accountId
                                  req.session.id_mahasiswa = id_mahasiswa
                                  req.session.adminId = adminResults[0].id; // Set ID admin
                                  res.redirect("/dashboard");
                              } else {
                                  console.log("Username atau password tidak valid.");
                                  res.render("login", { error: "Username atau password tidak valid." });
                              }
                          });
                      } else {
                          console.log("Admin tidak ditemukan.");
                          res.render("login", { error: "Admin tidak ditemukan." });
                      }
                  });
              } else {
                  console.log("Role tidak dikenali.");
                  res.render("login", { error: "Role tidak dikenali." });
              }
          } else {
              console.log("Username atau password tidak valid.");
              res.render("login", { error: "Username atau password tidak valid." });
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

    // Route to show the create account page for admin
    app.get("/akun-admin", (req, res) => {
      if (err) throw err
      res.render("akun-admin", { accountCreated: req.session.accountCreated })
    })

    // Route to show the create account page for a specific user
    app.get("/akun-mhs/:id", (req, res) => {
      const userId = req.params.id; // Get the user ID from the URL
      const sql = "SELECT * FROM akun WHERE user_id = ?"; // Assuming user_id is the foreign key in akun table

      db.query(sql, [userId], (err, result) => {
          if (err) throw err;

          // Check if an account exists for the user ID
          req.session.accountCreated = result.length > 0; // Set session variable based on existence of account
          res.render("akun-mhs", { accountCreated: req.session.accountCreated });
      });
    });

    // Route to show the create account page for a specific admin
    app.get("/akun-admin/:id", (req, res) => {
      const adminId = req.params.id; // Get the admin ID from the URL
      const sql = "SELECT * FROM akun WHERE admin_id = ?"; // Assuming admin_id is the foreign key in akun table

      db.query(sql, [adminId], (err, result) => {
          if (err) throw err;

          // Check if an account exists for the admin ID
          req.session.accountCreated = result.length > 0; // Set session variable based on existence of account
          res.render("akun-admin", { accountCreated: req.session.accountCreated, adminId: adminId });
      });
    });

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

    // Halaman pengaturan waktu absensi
    app.get("/pengaturan", (req, res) => {
      if (!req.session.username) {
          res.redirect("/login");
      } else {
          const sql = "SELECT * FROM pengaturan_absensi LIMIT 1"; // Ambil pengaturan yang ada
          db.query(sql, (err, result) => {
              if (err) throw err;
              const pengaturan = result.length > 0 ? result[0] : { jam_buka: '08:00:00', jam_tutup: '17:00:00' }; // Default jika tidak ada pengaturan
              res.render("pengaturan", { pengaturan, username: req.session.username });
          });
      }
    });

    // Route untuk menyimpan pengaturan waktu absensi
    app.post("/simpan-pengaturan-absensi", (req, res) => {
      const { jam_buka, jam_tutup } = req.body;

      if (jam_buka >= jam_tutup) {
        return res.render("pengaturan", { error: "Jam buka harus lebih awal dari jam tutup.", pengaturan: req.body, username: req.session.username });
    }

      const sql = "INSERT INTO pengaturan_absensi (jam_buka, jam_tutup) VALUES (?, ?) ON DUPLICATE KEY UPDATE jam_buka = ?, jam_tutup = ?";
      db.query(sql, [jam_buka, jam_tutup, jam_buka, jam_tutup], (err, result) => {
          if (err) throw err;
          res.redirect("/pengaturan"); // Redirect setelah menyimpan pengaturan
      });
    });

//   app.post("/tambah-absensi", (req, res) => {
//     const { status, alasan } = req.body; // Capture status and alasan from form
//     const id_mhs = req.session.id_mhs; // Get the mahasiswa ID from the session
//     const tanggal = moment().format("YYYY-MM-DD"); // Get the current date
//     const waktu = moment().format("HH:mm:ss"); // Get the current time

//     // Cek apakah sudah melakukan absensi hari ini
//     if (req.session.hasSubmittedAttendance && req.session.lastAttendanceDate === tanggal && req.session.lastIdMhs === id_mhs) {
//         return res.status(400).send("Anda sudah melakukan absensi hari ini."); // Berikan pesan jika sudah absensi
//     }

//     const sqlPengaturan = "SELECT jam_buka, jam_tutup FROM pengaturan_absensi LIMIT 1";
//     db.query(sqlPengaturan, (err, result) => {
//         if (err) throw err;
//         const pengaturan = result[0];
//         const jamBuka = moment(pengaturan.jam_buka, "HH:mm:ss");
//         const jamTutup = moment(pengaturan.jam_tutup, "HH:mm:ss");
//         const currentTime = moment(waktu, "HH:mm:ss");

//         if (currentTime.isBetween(jamBuka, jamTutup, null, '[]')) {
//             const insertSql = "INSERT INTO absensi (id_mhs, hari, tanggal, waktu, status, keterangan) VALUES (?, ?, ?, ?, ?, ?)";
//             const keterangan = status === "Hadir" ? null : alasan;

//             db.query(insertSql, [id_mhs, moment().format("dddd"), tanggal, waktu, status, alasan], (err, result) => {
//                 if (err) {
//                     console.error("Error inserting attendance:", err);
//                     return res.status(500).send("Error inserting attendance");
//                 }
//                 req.session.hasSubmittedAttendance = true; // Set session variable
//                 req.session.lastAttendanceDate = tanggal; // Simpan tanggal absensi
//                 req.session.lastIdMhs = id_mhs; // Simpan ID mahasiswa
//                 res.redirect("/absensi");
//             });
//         } else {
//             res.status(400).send("Waktu untuk melakukan absensi sudah lewat");
//         }
//     });
// });
app.post("/tambah-absensi", (req, res) => {
  const { status, alasan, id_mhs } = req.body; // Ambil id_mhs dari body
  const tanggal = moment().format("YYYY-MM-DD"); // Ambil tanggal saat ini
  const waktu = moment().format("HH:mm:ss"); // Ambil waktu saat ini

  // Cek apakah sudah melakukan absensi hari ini
  if (req.session.hasSubmittedAttendance && req.session.lastAttendanceDate === tanggal && req.session.lastIdMhs === id_mhs) {
      return res.status(400).send("Anda sudah melakukan absensi hari ini."); // Berikan pesan jika sudah absensi
  }

  const sqlPengaturan = "SELECT jam_buka, jam_tutup FROM pengaturan_absensi LIMIT 1";
  db.query(sqlPengaturan, (err, result) => {
      if (err) throw err;
      const pengaturan = result[0];
      const jamBuka = moment(pengaturan.jam_buka, "HH:mm:ss");
      const jamTutup = moment(pengaturan.jam_tutup, "HH:mm:ss");
      const currentTime = moment(waktu, "HH:mm:ss");

      if (currentTime.isBetween(jamBuka, jamTutup, null, '[]')) {
        // Validasi keterangan
        let keterangan = null;
        const insertSql = "INSERT INTO absensi (id_mhs, hari, tanggal, waktu, status, keterangan) VALUES (?, ?, ?, ?, ?, ?)";
        if (status === "Hadir") {
            // Jika status 'Hadir', keterangan adalah null
            keterangan = null;
        } else if (status === "Izin" || status === "Sakit") {
            // Jika status 'Izin' atau 'Sakit', pastikan keterangan tidak kosong
            if (!alasan || alasan.trim() === "") {
                return res.status(400).send("Keterangan tidak boleh kosong untuk status 'Izin' atau 'Sakit'.");
            }
            keterangan = alasan; // Simpan keterangan
        }

          db.query(insertSql, [id_mhs, moment().format("dddd"), tanggal, waktu, status, keterangan], (err, result) => {
              if (err) {
                  console.error("Error inserting attendance:", err);
                  return res.status(500).send("Error inserting attendance");
              }
              req.session.hasSubmittedAttendance = true; // Set session variable
              req.session.lastAttendanceDate = tanggal; // Simpan tanggal absensi
              req.session.lastIdMhs = id_mhs; // Simpan ID mahasiswa
              res.redirect("/absensi");
          });
      } else {
          res.status(400).send("Waktu untuk melakukan absensi sudah lewat");
      }
  });
});
app.get("/check-absensi/:id_mhs", (req, res) => {
  const id_mhs = req.params.id_mhs;
  const tanggal = moment().format("YYYY-MM-DD");

  const sql = "SELECT COUNT(*) AS count FROM absensi WHERE id_mhs = ? AND tanggal = ?";
  db.query(sql, [id_mhs, tanggal], (err, result) => {
      if (err) throw err;
      const hasSubmitted = result[0].count > 0; // Jika count lebih dari 0, berarti sudah absen
      res.json({ hasSubmitted }); // Mengembalikan status absensi dalam format JSON
  });
});

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
        const userId = req.session.userId
        const tanggalSekarang = moment().format("DD-MM-YYYY")
        const sql = "SELECT * FROM user WHERE id = ?"
        const sqlAbsensi = "SELECT * FROM absensi WHERE id_mhs = ? AND tanggal = ?";
        
        db.query(sql, [userId], (err, result) => {
          if (err) {
            console.error("Error fetching user data:", err); // Log error jika ada
            return res.status(500).send("Error fetching user data");
          }
          if (result.length === 0) {
            console.error("User  not found for ID:", userId); // Log jika tidak ada hasil
            return res.status(404).send("User  not found"); // Jika tidak ada hasil
          }

          const userData = result[0]
          db.query(sqlAbsensi, [userData.id, tanggalSekarang], (err, absensiResult) => {
            if (err) {
              console.error("Error fetching attendance data:", err);
              return res.status(500).send("Error fetching attendance data");
            }
          res.render("absensi", { userData: userData, username: req.session.username, tanggal: tanggalSekarang, absensiData: absensiResult })
        })
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
        const userId = req.session.userId
        console.log("User  ID from session:", userId)
        const sql = "SELECT * FROM user WHERE id = ?"

        db.query(sql, [userId], (err, result) => {
          if (err) {
            console.error("Error fetching user data:", err); // Log error jika ada
            return res.status(500).send("Error fetching user data");
          }
          if (result.length === 0) {
            console.error("User  not found for ID:", userId); // Log jika tidak ada hasil
            return res.status(404).send("User  not found"); // Jika tidak ada hasil
          }

          const userData = result[0]
          res.render("profil", { userData: userData, username: req.session.username })
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

  app.get("/absen-mhs", (req, res) => {
    if (!req.session.username) {
        res.redirect("/login");
    } else {
        const userId = req.session.userId;
        const sqlUser   = "SELECT * FROM user WHERE id = ?";
        const sqlPengaturan = "SELECT jam_buka, jam_tutup FROM pengaturan_absensi LIMIT 1";

        db.query(sqlUser  , [userId], (err, userResult) => {
            if (err) throw err;
            if (userResult.length === 0) {
                return res.status(404).send("User  not found");
            }

            const tanggalHariIni = moment().format("YYYY-MM-DD");
            const tanggalAbsensi = req.session.lastAttendanceDate || "";

            // Reset status jika hari ini adalah hari baru
            if (tanggalAbsensi !== tanggalHariIni) {
                req.session.hasSubmittedAttendance = false; // Reset status
                req.session.lastAttendanceDate = tanggalHariIni; // Simpan tanggal absensi
                req.session.lastIdMhs = null; // Reset ID mahasiswa
            }

            db.query(sqlPengaturan, (err, pengaturanResult) => {
                if (err) throw err;
                const pengaturan = pengaturanResult[0] || { jam_buka: '00:00:00', jam_tutup: '23:59:59' };

                res.render("absen-mhs", {
                    userData: userResult[0],
                    username: req.session.username,
                    pengaturan: pengaturan,
                    hasSubmittedAttendance: req.session.hasSubmittedAttendance || false // Kirim status ke view
                });
            });
        });
    }
});
    
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
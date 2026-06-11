const express = require("express");
const cors = require("cors");
const db = require("./db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());

const uploadFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

app.use("/uploads", express.static(uploadFolder));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

app.get("/", (req, res) => {
  res.send("Backend is running");
});

const getFloorName = (floorNumber) => {
  const names = {
    1: "First Floor",
    2: "Second Floor",
    3: "Third Floor",
    4: "Fourth Floor",
    5: "Fifth Floor",
    6: "Sixth Floor",
    7: "Seventh Floor",
    8: "Eighth Floor",
    9: "Ninth Floor",
    10: "Tenth Floor",
  };

  return names[floorNumber] || `Floor ${floorNumber}`;
};

const getTodayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// =============================
// STUDENTS
// =============================

app.post("/students/register", (req, res) => {
  const { full_name, username, email, phone, password } = req.body;

  if (!full_name || !username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Full name, username, email, and password are required",
    });
  }

  const checkSql = "SELECT * FROM students WHERE username = ? OR email = ?";

  db.query(checkSql, [username, email], (checkErr, checkResult) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: "Error checking existing student",
        error: checkErr,
      });
    }

    if (checkResult.length > 0) {
      return res.json({
        success: false,
        message: "Username or email already exists",
      });
    }

    const insertSql =
      "INSERT INTO students (full_name, username, email, phone, password) VALUES (?, ?, ?, ?, ?)";

    db.query(
      insertSql,
      [full_name, username, email, phone, password],
      (insertErr, insertResult) => {
        if (insertErr) {
          return res.status(500).json({
            success: false,
            message: "Student registration failed",
            error: insertErr,
          });
        }

        const getStudentSql = "SELECT * FROM students WHERE student_id = ?";

        db.query(getStudentSql, [insertResult.insertId], (getErr, getResult) => {
          if (getErr) {
            return res.status(500).json({
              success: false,
              message: "Student registered, but fetch failed",
              error: getErr,
            });
          }

          res.json({
            success: true,
            message: "Student registered successfully",
            user: getResult[0],
          });
        });
      }
    );
  });
});

app.post("/students/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required",
    });
  }

  const sql = "SELECT * FROM students WHERE username = ? AND password = ?";

  db.query(sql, [username, password], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Student login failed",
        error: err,
      });
    }

    if (result.length > 0) {
      return res.json({
        success: true,
        message: "Student login successful",
        user: result[0],
      });
    }

    res.json({
      success: false,
      message: "Invalid student username or password",
    });
  });
});

// =============================
// ADMINS
// =============================

app.post("/admins/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required",
    });
  }

  const sql = "SELECT * FROM admins WHERE username = ? AND password = ?";

  db.query(sql, [username, password], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Admin login failed",
        error: err,
      });
    }

    if (result.length > 0) {
      return res.json({
        success: true,
        message: "Admin login successful",
        admin: result[0],
      });
    }

    res.json({
      success: false,
      message: "Invalid admin username or password",
    });
  });
});

// =============================
// FLOORS
// =============================

app.get("/floors", (req, res) => {
  const sql = "SELECT * FROM floors ORDER BY floor_number ASC";

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch floors",
        error: err,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

app.post("/floors", (req, res) => {
  const getLastFloorSql = "SELECT MAX(floor_number) AS last_floor FROM floors";

  db.query(getLastFloorSql, (getErr, getResult) => {
    if (getErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to check last floor",
        error: getErr,
      });
    }

    const lastFloor = getResult[0].last_floor || 0;
    const nextFloorNumber = lastFloor + 1;
    const nextFloorName = getFloorName(nextFloorNumber);

    const insertSql =
      "INSERT INTO floors (floor_number, floor_name) VALUES (?, ?)";

    db.query(insertSql, [nextFloorNumber, nextFloorName], (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to add floor",
          error: err,
        });
      }

      res.json({
        success: true,
        message: "Floor added successfully",
        data: {
          floor_id: result.insertId,
          floor_number: nextFloorNumber,
          floor_name: nextFloorName,
        },
      });
    });
  });
});

// =============================
// ROOMS
// =============================

app.get("/rooms", (req, res) => {
  const today = getTodayDate();

  const sql = `
    SELECT 
      rooms.room_id,
      rooms.floor_id,
      rooms.room_number,
      rooms.room_type,
      rooms.capacity,
      rooms.price,
      rooms.day_price,
      rooms.week_price,
      rooms.month_price,
      rooms.room_image,
      floors.floor_number,
      floors.floor_name,
      COALESCE(total_bookings.booking_count, 0) AS booking_count,
      CASE
        WHEN COALESCE(active_bookings.active_count, 0) > 0 THEN 'booked'
        ELSE 'available'
      END AS calculated_status
    FROM rooms
    JOIN floors ON rooms.floor_id = floors.floor_id
    LEFT JOIN (
      SELECT 
        room_id,
        COUNT(*) AS booking_count
      FROM bookings
      WHERE status IN ('pending', 'approved')
      GROUP BY room_id
    ) AS total_bookings ON rooms.room_id = total_bookings.room_id
    LEFT JOIN (
      SELECT 
        room_id,
        COUNT(*) AS active_count
      FROM bookings
      WHERE status IN ('pending', 'approved')
        AND start_date <= ?
        AND end_date >= ?
      GROUP BY room_id
    ) AS active_bookings ON rooms.room_id = active_bookings.room_id
    ORDER BY floors.floor_number ASC, rooms.room_number ASC
  `;

  db.query(sql, [today, today], (err, result) => {
    if (err) {
      console.log("Rooms route error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch rooms",
        error: err,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

app.post("/rooms", (req, res) => {
  const {
    floor_id,
    room_type,
    capacity,
    day_price,
    week_price,
    month_price,
    status,
    room_image,
  } = req.body;

  if (
    !floor_id ||
    !room_type ||
    !capacity ||
    !day_price ||
    !week_price ||
    !month_price
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Floor, room type, capacity, day price, week price, and month price are required",
    });
  }

  const getLastRoomSql = `
    SELECT
      floors.floor_number,
      MAX(CAST(rooms.room_number AS UNSIGNED)) AS last_room_number
    FROM floors
    LEFT JOIN rooms ON floors.floor_id = rooms.floor_id
    WHERE floors.floor_id = ?
    GROUP BY floors.floor_id, floors.floor_number
  `;

  db.query(getLastRoomSql, [floor_id], (getErr, getResult) => {
    if (getErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to check last room number",
        error: getErr,
      });
    }

    if (getResult.length === 0) {
      return res.json({
        success: false,
        message: "Floor not found",
      });
    }

    const floorNumber = Number(getResult[0].floor_number);
    const lastRoomNumber = getResult[0].last_room_number;

    const nextRoomNumber = lastRoomNumber
      ? Number(lastRoomNumber) + 1
      : floorNumber * 100 + 1;

    const sql = `
      INSERT INTO rooms
      (
        floor_id,
        room_number,
        room_type,
        capacity,
        price,
        day_price,
        week_price,
        month_price,
        status,
        room_image
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        floor_id,
        nextRoomNumber,
        room_type,
        capacity,
        day_price,
        day_price,
        week_price,
        month_price,
        status || "available",
        room_image || null,
      ],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Failed to add room",
            error: err,
          });
        }

        res.json({
          success: true,
          message: "Room added successfully",
          data: {
            room_id: result.insertId,
            room_number: nextRoomNumber,
          },
        });
      }
    );
  });
});

// Update room by admin
app.put("/rooms/:id", (req, res) => {
  const { id } = req.params;

  const {
    room_type,
    capacity,
    day_price,
    week_price,
    month_price,
    status,
    room_image,
  } = req.body;

  if (
    !room_type ||
    !capacity ||
    !day_price ||
    !week_price ||
    !month_price ||
    !status
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Room type, capacity, day price, week price, month price, and status are required",
    });
  }

  const updateSql = `
    UPDATE rooms
    SET 
      room_type = ?,
      capacity = ?,
      price = ?,
      day_price = ?,
      week_price = ?,
      month_price = ?,
      status = ?,
      room_image = ?
    WHERE room_id = ?
  `;

  db.query(
    updateSql,
    [
      room_type,
      capacity,
      day_price,
      day_price,
      week_price,
      month_price,
      status,
      room_image || null,
      id,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to update room",
          error: err,
        });
      }

      res.json({
        success: true,
        message: "Room updated successfully",
        data: result,
      });
    }
  );
});

// =============================
// BOOKINGS
// =============================

// All bookings for admin
app.get("/bookings", (req, res) => {
  const sql = `
    SELECT
      bookings.booking_id,
      bookings.student_id,
      bookings.room_id,
      bookings.booking_date,
      bookings.start_date,
      bookings.end_date,
      bookings.status,
      bookings.notes,
      bookings.booking_duration,
      bookings.people_count,
      bookings.payment_method,
      bookings.payment_number,
      bookings.total_price,
      bookings.price_per_person,
      students.full_name,
      students.username,
      rooms.room_number,
      rooms.room_type,
      floors.floor_number,
      floors.floor_name
    FROM bookings
    JOIN students ON bookings.student_id = students.student_id
    JOIN rooms ON bookings.room_id = rooms.room_id
    JOIN floors ON rooms.floor_id = floors.floor_id
    ORDER BY bookings.booking_id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch bookings",
        error: err,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

// Bookings for admin calendar
app.get("/bookings/calendar", (req, res) => {
  const sql = `
    SELECT
      bookings.booking_id,
      bookings.student_id,
      bookings.room_id,
      bookings.start_date,
      bookings.end_date,
      bookings.status,
      bookings.booking_duration,
      bookings.people_count,
      bookings.payment_method,
      bookings.total_price,
      bookings.price_per_person,
      students.full_name,
      students.username,
      rooms.room_number,
      rooms.room_type,
      floors.floor_number,
      floors.floor_name
    FROM bookings
    JOIN students ON bookings.student_id = students.student_id
    JOIN rooms ON bookings.room_id = rooms.room_id
    JOIN floors ON rooms.floor_id = floors.floor_id
    WHERE bookings.status IN ('pending', 'approved')
    ORDER BY bookings.start_date ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch calendar bookings",
        error: err,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

// Bookings for one student
app.get("/bookings/student/:studentId", (req, res) => {
  const { studentId } = req.params;

  const sql = `
    SELECT
      bookings.booking_id,
      bookings.student_id,
      bookings.room_id,
      bookings.booking_date,
      bookings.start_date,
      bookings.end_date,
      bookings.status,
      bookings.notes,
      bookings.booking_duration,
      bookings.people_count,
      bookings.payment_method,
      bookings.payment_number,
      bookings.total_price,
      bookings.price_per_person,
      rooms.room_number,
      rooms.room_type,
      rooms.capacity,
      rooms.price,
      rooms.day_price,
      rooms.week_price,
      rooms.month_price,
      floors.floor_number,
      floors.floor_name
    FROM bookings
    JOIN rooms ON bookings.room_id = rooms.room_id
    JOIN floors ON rooms.floor_id = floors.floor_id
    WHERE bookings.student_id = ?
    ORDER BY bookings.booking_id DESC
  `;

  db.query(sql, [studentId], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch student bookings",
        error: err,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

// Add new booking
app.post("/bookings", (req, res) => {
  const {
    student_id,
    room_id,
    start_date,
    end_date,
    booking_duration,
    people_count,
    payment_method,
    payment_number,
    notes,
  } = req.body;

  if (
    !student_id ||
    !room_id ||
    !start_date ||
    !end_date ||
    !booking_duration ||
    !people_count ||
    !payment_method
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Student, room, dates, duration, people count, and payment method are required",
    });
  }

  const today = getTodayDate();

  if (start_date < today) {
    return res.status(400).json({
      success: false,
      message: "You cannot book a previous date",
    });
  }

  if (end_date < start_date) {
    return res.status(400).json({
      success: false,
      message: "End date cannot be before start date",
    });
  }

  if (!["day", "week", "month"].includes(booking_duration)) {
    return res.status(400).json({
      success: false,
      message: "Booking duration must be day, week, or month",
    });
  }

  if (!["cash", "wish", "omt"].includes(payment_method)) {
    return res.status(400).json({
      success: false,
      message: "Payment method must be cash, wish, or omt",
    });
  }

  if (
    (payment_method === "wish" || payment_method === "omt") &&
    !payment_number
  ) {
    return res.status(400).json({
      success: false,
      message: "Payment number is required for Wish or OMT",
    });
  }

  const getRoomSql = `
    SELECT 
      room_id,
      capacity,
      day_price,
      week_price,
      month_price
    FROM rooms
    WHERE room_id = ?
  `;

  db.query(getRoomSql, [room_id], (roomErr, roomResult) => {
    if (roomErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to check room",
        error: roomErr,
      });
    }

    if (roomResult.length === 0) {
      return res.json({
        success: false,
        message: "Room not found",
      });
    }

    const room = roomResult[0];

    const peopleCountNumber = Number(people_count);

    if (
      peopleCountNumber < 1 ||
      peopleCountNumber > Number(room.capacity)
    ) {
      return res.json({
        success: false,
        message: "People count cannot be greater than room capacity",
      });
    }

    const checkOverlapSql = `
      SELECT COUNT(*) AS overlap_count
      FROM bookings
      WHERE room_id = ?
        AND status IN ('pending', 'approved')
        AND start_date <= ?
        AND end_date >= ?
    `;

    db.query(
      checkOverlapSql,
      [room_id, end_date, start_date],
      (overlapErr, overlapResult) => {
        if (overlapErr) {
          return res.status(500).json({
            success: false,
            message: "Failed to check room availability",
            error: overlapErr,
          });
        }

        if (Number(overlapResult[0].overlap_count) > 0) {
          return res.json({
            success: false,
            message: "This room is already booked during the selected dates",
          });
        }

        let selectedRoomPrice = 0;

        if (booking_duration === "day") {
          selectedRoomPrice = Number(room.day_price);
        } else if (booking_duration === "week") {
          selectedRoomPrice = Number(room.week_price);
        } else if (booking_duration === "month") {
          selectedRoomPrice = Number(room.month_price);
        }

        if (!selectedRoomPrice || selectedRoomPrice <= 0) {
          return res.json({
            success: false,
            message: "Room price is not set correctly",
          });
        }

        const totalPrice = selectedRoomPrice;
        const pricePerPerson = Number(
          (totalPrice / peopleCountNumber).toFixed(2)
        );

        const insertSql = `
          INSERT INTO bookings
          (
            student_id,
            room_id,
            start_date,
            end_date,
            status,
            notes,
            booking_duration,
            people_count,
            payment_method,
            payment_number,
            total_price,
            price_per_person
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
          insertSql,
          [
            student_id,
            room_id,
            start_date,
            end_date,
            "pending",
            notes || null,
            booking_duration,
            peopleCountNumber,
            payment_method,
            payment_method === "cash" ? null : payment_number,
            totalPrice,
            pricePerPerson,
          ],
          (insertErr, insertResult) => {
            if (insertErr) {
              return res.status(500).json({
                success: false,
                message: "Failed to add booking",
                error: insertErr,
              });
            }

            res.json({
              success: true,
              message: "Booking added successfully",
              data: insertResult,
            });
          }
        );
      }
    );
  });
});

// Update booking status by admin
app.put("/bookings/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be approved or rejected",
    });
  }

  const checkSql = "SELECT * FROM bookings WHERE booking_id = ?";

  db.query(checkSql, [id], (checkErr, checkResult) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to check booking",
        error: checkErr,
      });
    }

    if (checkResult.length === 0) {
      return res.json({
        success: false,
        message: "Booking not found",
      });
    }

    if (checkResult[0].status !== "pending") {
      return res.json({
        success: false,
        message: "Only pending bookings can be approved or rejected",
      });
    }

    const updateSql = "UPDATE bookings SET status = ? WHERE booking_id = ?";

    db.query(updateSql, [status, id], (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to update booking status",
          error: err,
        });
      }

      res.json({
        success: true,
        message: `Booking ${status} successfully`,
        data: result,
      });
    });
  });
});

// Update booking only if pending
app.put("/bookings/:id", (req, res) => {
  const { id } = req.params;
  const { start_date, end_date, notes } = req.body;

  const checkSql = "SELECT * FROM bookings WHERE booking_id = ?";

  db.query(checkSql, [id], (checkErr, checkResult) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to check booking",
        error: checkErr,
      });
    }

    if (checkResult.length === 0) {
      return res.json({
        success: false,
        message: "Booking not found",
      });
    }

    if (checkResult[0].status !== "pending") {
      return res.json({
        success: false,
        message: "Only pending bookings can be edited",
      });
    }

    const updateSql =
      "UPDATE bookings SET start_date = ?, end_date = ?, notes = ? WHERE booking_id = ?";

    db.query(
      updateSql,
      [start_date, end_date, notes || null, id],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Failed to update booking",
            error: err,
          });
        }

        res.json({
          success: true,
          message: "Booking updated successfully",
          data: result,
        });
      }
    );
  });
});

// Delete booking only if pending
app.delete("/bookings/:id", (req, res) => {
  const { id } = req.params;

  const checkSql = "SELECT * FROM bookings WHERE booking_id = ?";

  db.query(checkSql, [id], (checkErr, checkResult) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to check booking",
        error: checkErr,
      });
    }

    if (checkResult.length === 0) {
      return res.json({
        success: false,
        message: "Booking not found",
      });
    }

    if (checkResult[0].status !== "pending") {
      return res.json({
        success: false,
        message: "Only pending bookings can be deleted",
      });
    }

    const deleteSql = "DELETE FROM bookings WHERE booking_id = ?";

    db.query(deleteSql, [id], (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to delete booking",
          error: err,
        });
      }

      res.json({
        success: true,
        message: "Booking deleted successfully",
        data: result,
      });
    });
  });
});

// =============================
// FEEDBACKS
// =============================

const analyzeFeedback = (text) => {
  const feedback = String(text || "")
    .toLowerCase()
    .replace(/[ًٌٍَُِّْ]/g, "")
    .trim();

  let positiveScore = 0;
  let negativeScore = 0;

  const positiveWords = [
    "good",
    "great",
    "excellent",
    "nice",
    "clean",
    "comfortable",
    "quiet",
    "beautiful",
    "perfect",
    "amazing",
    "organized",
    "spacious",
    "cheap",
    "affordable",

    "جيد",
    "جيدة",
    "ممتاز",
    "ممتازة",
    "حلو",
    "حلوة",
    "نظيف",
    "نظيفة",
    "مريح",
    "مريحة",
    "هادئ",
    "هادئة",
    "مرتب",
    "مرتبة",
    "واسع",
    "واسعة",
    "جميل",
    "جميلة",
    "رخيص",
    "رخيصة",
    "مناسب",
    "مناسبة",
  ];

  const negativeWords = [
    "bad",
    "dirty",
    "noisy",
    "uncomfortable",
    "small",
    "expensive",
    "problem",
    "broken",
    "hot",
    "cold",
    "poor",
    "terrible",

    "سيء",
    "سيئة",
    "وسخ",
    "وسخة",
    "متسخ",
    "متسخة",
    "مزعج",
    "مزعجة",
    "ضجيج",
    "صغير",
    "صغيرة",
    "غالي",
    "غالية",
    "مشكلة",
    "مكسور",
    "مكسورة",
    "حر",
    "برد",
    "تعبان",
    "تعبانة",
  ];

  const negativePhrases = [
    "not clean",
    "not good",
    "not comfortable",
    "not quiet",
    "not nice",
    "not organized",

    "مش نظيف",
    "مش نظيفة",
    "مش مريح",
    "مش مريحة",
    "مش جيد",
    "مش جيدة",
    "مش حلو",
    "مش حلوة",
    "مش هادئ",
    "مش هادئة",

    "مو نظيف",
    "مو نظيفة",
    "مو مريح",
    "مو مريحة",

    "غير نظيف",
    "غير نظيفة",
    "غير مريح",
    "غير مريحة",
    "غير جيد",
    "غير جيدة",
  ];

  positiveWords.forEach((word) => {
    if (feedback.includes(word)) {
      positiveScore += 1;
    }
  });

  negativeWords.forEach((word) => {
    if (feedback.includes(word)) {
      negativeScore += 1;
    }
  });

  negativePhrases.forEach((phrase) => {
    if (feedback.includes(phrase)) {
      negativeScore += 2;
    }
  });

  if (positiveScore > negativeScore) {
    return "Positive";
  }

  if (negativeScore > positiveScore) {
    return "Negative";
  }

  return "Neutral";
};

// Get all feedbacks for admin
app.get("/feedbacks", (req, res) => {
  const sql = `
    SELECT
      feedbacks.feedback_id,
      feedbacks.booking_id,
      feedbacks.feedback_text,
      feedbacks.ai_analysis,
      feedbacks.created_at,
      bookings.student_id,
      bookings.room_id,
      students.full_name,
      students.username,
      rooms.room_number,
      rooms.room_type,
      floors.floor_number,
      floors.floor_name
    FROM feedbacks
    JOIN bookings ON feedbacks.booking_id = bookings.booking_id
    JOIN students ON bookings.student_id = students.student_id
    JOIN rooms ON bookings.room_id = rooms.room_id
    JOIN floors ON rooms.floor_id = floors.floor_id
    ORDER BY feedbacks.created_at DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch feedbacks",
        error: err,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

// Get booked rooms for one student to write feedback
app.get("/feedbacks/student-approved-rooms/:studentId", (req, res) => {
  const { studentId } = req.params;

  const sql = `
    SELECT
      bookings.booking_id,
      bookings.room_id,
      bookings.start_date,
      bookings.end_date,
      rooms.room_number,
      rooms.room_type,
      floors.floor_number,
      floors.floor_name
    FROM bookings
    JOIN rooms ON bookings.room_id = rooms.room_id
    JOIN floors ON rooms.floor_id = floors.floor_id
    LEFT JOIN feedbacks ON bookings.booking_id = feedbacks.booking_id
    WHERE bookings.student_id = ?
      AND bookings.status IN ('pending', 'approved')
      AND feedbacks.feedback_id IS NULL
    ORDER BY floors.floor_number ASC, rooms.room_number ASC
  `;

  db.query(sql, [studentId], (err, result) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch booked rooms",
        error: err,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  });
});

// Add feedback from student
app.post("/feedbacks", (req, res) => {
  const { booking_id, feedback_text } = req.body;

  if (!booking_id || !feedback_text) {
    return res.status(400).json({
      success: false,
      message: "Booking and feedback text are required",
    });
  }

  const checkBookedSql = `
    SELECT
      bookings.booking_id,
      bookings.status
    FROM bookings
    WHERE bookings.booking_id = ?
      AND bookings.status IN ('pending', 'approved')
  `;

  db.query(checkBookedSql, [booking_id], (checkErr, checkResult) => {
    if (checkErr) {
      return res.status(500).json({
        success: false,
        message: "Failed to check booking",
        error: checkErr,
      });
    }

    if (checkResult.length === 0) {
      return res.json({
        success: false,
        message: "You can only write feedback for booked rooms",
      });
    }

    const booking = checkResult[0];

    const checkFeedbackSql = "SELECT * FROM feedbacks WHERE booking_id = ?";

    db.query(checkFeedbackSql, [booking_id], (feedbackErr, feedbackResult) => {
      if (feedbackErr) {
        return res.status(500).json({
          success: false,
          message: "Failed to check existing feedback",
          error: feedbackErr,
        });
      }

      if (feedbackResult.length > 0) {
        return res.json({
          success: false,
          message: "You already submitted feedback for this booking",
        });
      }

      const aiAnalysis = analyzeFeedback(feedback_text);

      const insertSql = `
        INSERT INTO feedbacks
        (booking_id, feedback_text, ai_analysis)
        VALUES (?, ?, ?)
      `;

      db.query(
        insertSql,
        [booking.booking_id, feedback_text, aiAnalysis],
        (insertErr, insertResult) => {
          if (insertErr) {
            return res.status(500).json({
              success: false,
              message: "Failed to submit feedback",
              error: insertErr,
            });
          }

          res.json({
            success: true,
            message: "Feedback submitted successfully",
            data: insertResult,
          });
        }
      );
    });
  });
});

// =============================
// SERVER
// =============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
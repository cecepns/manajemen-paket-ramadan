/**
 * API Manajemen Paket Ramadan — satu file Express + MySQL.
 * Upload file: folder ./uoloads-manajemen-paket-ramadan (ter-mount di /uploads)
 */
require('dotenv/config')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const express = require('express')
const multer = require('multer')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')

const APP_KEY = process.env.APP_KEY || 'change-this-secret-key'
const PORT = Number(process.env.PORT || 8080)
const UPLOAD_ROOT = path.join(__dirname, 'uoloads-manajemen-paket-ramadan')
const PRODUCT_UPLOAD_SUB = 'products'
const DEPOSIT_UPLOAD_SUB = 'deposits'

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'management_paket_ramadhan',
  waitForConnections: true,
  connectionLimit: 10,
})

const PERIOD_MULTIPLIERS = {
  legacy: 1,
  '295_hari': 295,
  '325_hari': 325,
  '42_minggu': 42,
  '45_minggu': 45,
}

function periodMultiplier(code) {
  if (!code) return 1
  return PERIOD_MULTIPLIERS[code] ?? 1
}

function md5(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex')
}

function makeToken(userId) {
  const hash = crypto.createHash('sha256').update(`${userId}|${APP_KEY}`).digest('hex')
  return Buffer.from(`${userId}|${hash}`, 'utf8').toString('base64')
}

function makeResellerToken(resellerId) {
  const payload = `r:${resellerId}`
  const hash = crypto.createHash('sha256').update(`${payload}|${APP_KEY}`).digest('hex')
  return Buffer.from(`${payload}|${hash}`, 'utf8').toString('base64')
}

function parseAuth(req) {
  const raw = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim())
  if (!m) return null
  const token = m[1].trim()
  let decoded
  try {
    decoded = Buffer.from(token, 'base64').toString('utf8')
  } catch {
    return null
  }
  if (decoded.startsWith('r:')) {
    const pipePos = decoded.indexOf('|')
    if (pipePos === -1) return null
    const payload = decoded.slice(0, pipePos)
    const hash = decoded.slice(pipePos + 1)
    const rid = parseInt(payload.slice(2), 10)
    if (rid <= 0) return null
    const expected = crypto.createHash('sha256').update(`${payload}|${APP_KEY}`).digest('hex')
    if (!timingEqual(hash, expected)) return null
    return { role: 'reseller', id: rid }
  }
  const pipePos = decoded.indexOf('|')
  if (pipePos === -1) return null
  const uid = parseInt(decoded.slice(0, pipePos), 10)
  const hash = decoded.slice(pipePos + 1)
  if (uid <= 0) return null
  const expected = crypto.createHash('sha256').update(`${uid}|${APP_KEY}`).digest('hex')
  if (!timingEqual(hash, expected)) return null
  return { role: 'admin', id: uid }
}

function timingEqual(a, b) {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function json(res, data, status = 200, meta = {}) {
  res.status(status).json({ data, meta })
}

function err(res, message, status = 400) {
  json(res, { message }, status)
}

async function ensureUploadDirs() {
  for (const sub of [PRODUCT_UPLOAD_SUB, DEPOSIT_UPLOAD_SUB]) {
    const dir = path.join(UPLOAD_ROOT, sub)
    await fs.promises.mkdir(dir, { recursive: true })
  }
}

function safeExt(original) {
  const e = path.extname(original || '').toLowerCase().replace(/[^.a-z0-9]/g, '')
  return e && e.length <= 8 ? e : '.jpg'
}

const storageProducts = multer.diskStorage({
  destination: (_req, _f, cb) => cb(null, path.join(UPLOAD_ROOT, PRODUCT_UPLOAD_SUB)),
  filename: (_req, file, cb) => {
    const name = `product_${crypto.randomBytes(8).toString('hex')}${safeExt(file.originalname)}`
    cb(null, name)
  },
})

const storageDeposits = multer.diskStorage({
  destination: (_req, _f, cb) => cb(null, path.join(UPLOAD_ROOT, DEPOSIT_UPLOAD_SUB)),
  filename: (_req, file, cb) => {
    const name = `deposit_${crypto.randomBytes(8).toString('hex')}${safeExt(file.originalname)}`
    cb(null, name)
  },
})

const uploadProduct = multer({ storage: storageProducts })
const uploadDeposit = multer({ storage: storageDeposits })

function unlinkRelPaths(relPath) {
  if (!relPath) return
  const clean = String(relPath).replace(/^\/+/, '').replace(/^uploads\/?/i, '')
  const full = path.join(UPLOAD_ROOT, clean)
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full)
  } catch {
    /* ignore */
  }
}

const app = express()
app.use(cors({ origin: '*', exposedHeaders: ['Content-Type'] }))
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(UPLOAD_ROOT))

function authActor(req, res) {
  const actor = parseAuth(req)
  if (!actor) {
    err(res, 'Unauthorized', 401)
    return null
  }
  return actor
}

function authAdmin(req, res) {
  const a = authActor(req, res)
  if (!a) return null
  if (a.role !== 'admin') {
    err(res, 'Forbidden', 403)
    return null
  }
  return a
}

function authRoles(req, res, roles) {
  const a = authActor(req, res)
  if (!a) return null
  if (!roles.includes(a.role)) {
    err(res, 'Forbidden', 403)
    return null
  }
  return a
}

// ——— Routes ———

app.options('*', (_req, res) => res.sendStatus(204))

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    const u = typeof username === 'string' ? username.trim() : ''
    const p = typeof password === 'string' ? password : ''
    if (!u || !p) return err(res, 'Username dan password wajib diisi', 422)
    const [rows] = await pool.query('SELECT id, username FROM users WHERE username = ? AND password = ? LIMIT 1', [u, md5(p)])
    if (!rows.length) return err(res, 'Login gagal', 401)
    const user = rows[0]
    json(res, {
      token: makeToken(user.id),
      role: 'admin',
      user: { id: user.id, username: user.username },
    })
  } catch (e) {
    console.error(e)
    err(res, 'Terjadi kesalahan pada server', 500)
  }
})

app.post('/reseller_login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    const u = typeof username === 'string' ? username.trim() : ''
    const p = typeof password === 'string' ? password : ''
    if (!u || !p) return err(res, 'Username dan password wajib diisi', 422)
    const [rows] = await pool.query(
      'SELECT id, name, password_hash FROM resellers WHERE login_username = ? LIMIT 1',
      [u],
    )
    if (!rows.length || !rows[0].password_hash) return err(res, 'Login gagal', 401)
    if (!bcrypt.compareSync(p, rows[0].password_hash)) return err(res, 'Login gagal', 401)
    json(res, {
      token: makeResellerToken(rows[0].id),
      role: 'reseller',
      reseller: { id: rows[0].id, name: rows[0].name },
    })
  } catch (e) {
    console.error(e)
    err(res, 'Terjadi kesalahan pada server', 500)
  }
})

app.get('/dashboard', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    if (actor.role === 'admin') {
      const [[products]] = await pool.query('SELECT COUNT(*) AS c FROM products')
      const [[resellers]] = await pool.query('SELECT COUNT(*) AS c FROM resellers')
      const [[orders]] = await pool.query('SELECT COUNT(*) AS c FROM orders')
      const [[rev]] = await pool.query('SELECT COALESCE(SUM(total_amount),0) AS s FROM orders')
      return json(res, {
        role: 'admin',
        products: Number(products.c),
        resellers: Number(resellers.c),
        orders: Number(orders.c),
        revenue: Number(rev.s),
      })
    }
    const [[row]] = await pool.query('SELECT COUNT(*) AS c, COALESCE(SUM(total_amount),0) AS s FROM orders WHERE reseller_id = ?', [
      actor.id,
    ])
    json(res, {
      role: 'reseller',
      reseller_id: actor.id,
      orders: Number(row.c),
      revenue: Number(row.s),
    })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat dashboard', 500)
  }
})

app.get('/package_categories', async (req, res) => {
  if (!authRoles(req, res, ['admin', 'reseller'])) return
  try {
    const [rows] = await pool.query('SELECT * FROM package_categories ORDER BY name ASC')
    json(res, rows, 200, {})
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat kategori', 500)
  }
})

app.post('/package_categories_save', async (req, res) => {
  if (!authAdmin(req, res)) return
  try {
    const body = req.body || {}
    const id = parseInt(body.id, 10) || 0
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return err(res, 'Nama kategori wajib diisi', 422)
    if (id > 0) {
      await pool.query('UPDATE package_categories SET name = ?, updated_at = NOW() WHERE id = ?', [name, id])
      return json(res, { id })
    }
    const [r] = await pool.query('INSERT INTO package_categories (name, created_at, updated_at) VALUES (?, NOW(), NOW())', [name])
    json(res, { id: r.insertId })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menyimpan kategori', 500)
  }
})

app.post('/package_categories_delete', async (req, res) => {
  if (!authAdmin(req, res)) return
  try {
    const id = parseInt((req.body || {}).id, 10) || 0
    if (id <= 0) return err(res, 'ID tidak valid', 422)
    await pool.query('UPDATE products SET category_id = NULL WHERE category_id = ?', [id])
    await pool.query('DELETE FROM package_categories WHERE id = ?', [id])
    json(res, { deleted: true })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menghapus kategori', 500)
  }
})

app.get('/products', async (req, res) => {
  if (!authRoles(req, res, ['admin', 'reseller'])) return
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const categoryId = req.query.category_id != null && req.query.category_id !== '' ? parseInt(req.query.category_id, 10) : null
    let where = '1=1'
    const params = []
    if (q !== '') {
      where += ' AND (p.name LIKE ? OR p.description LIKE ?)'
      const like = `%${q}%`
      params.push(like, like)
    }
    if (categoryId && categoryId > 0) {
      where += ' AND p.category_id = ?'
      params.push(categoryId)
    }
    const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM products p WHERE ${where}`, params)
    const total = Number(countRows[0].c)
    const [rows] = await pool.query(
      `SELECT p.*, pc.name AS category_name FROM products p
       LEFT JOIN package_categories pc ON pc.id = p.category_id
       WHERE ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )
    json(res, rows, 200, {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat produk', 500)
  }
})

app.post('/products_save', uploadProduct.single('image'), async (req, res) => {
  if (!authAdmin(req, res)) return
  try {
    const id = parseInt(req.body.id, 10) || 0
    const name = (req.body.name || '').trim()
    const price = parseFloat(req.body.price) || 0
    const paymentDaysTotal = Math.max(0, parseInt(req.body.payment_days_total, 10) || 0)
    const stock = parseInt(req.body.stock, 10) || 0
    const description = (req.body.description || '').trim()
    const categoryIdRaw = req.body.category_id
    const categoryId =
      categoryIdRaw === '' || categoryIdRaw === undefined || categoryIdRaw === null
        ? null
        : parseInt(categoryIdRaw, 10) || null

    const newImage = req.file ? `/uploads/${PRODUCT_UPLOAD_SUB}/${req.file.filename}` : null

    if (id > 0) {
      const [[old]] = await pool.query('SELECT image_path FROM products WHERE id = ?', [id])
      const imagePath = newImage || old?.image_path || null
      await pool.query(
        'UPDATE products SET name=?, price=?, payment_days_total=?, stock=?, description=?, image_path=?, category_id=?, updated_at=NOW() WHERE id=?',
        [name, price, paymentDaysTotal, stock, description, imagePath, categoryId, id],
      )
      if (newImage && old?.image_path && old.image_path !== newImage) unlinkRelPaths(old.image_path)
      return json(res, { id })
    }
    const [ins] = await pool.query(
      `INSERT INTO products (name, price, payment_days_total, stock, description, image_path, category_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,NOW(),NOW())`,
      [name, price, paymentDaysTotal, stock, description, newImage, categoryId],
    )
    json(res, { id: ins.insertId })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menyimpan produk', 500)
  }
})

app.post('/products_delete', async (req, res) => {
  if (!authAdmin(req, res)) return
  try {
    const id = parseInt((req.body || {}).id, 10) || 0
    const [[row]] = await pool.query('SELECT image_path FROM products WHERE id = ?', [id])
    await pool.query('DELETE FROM products WHERE id = ?', [id])
    unlinkRelPaths(row?.image_path)
    json(res, { deleted: true })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menghapus produk', 500)
  }
})

const daysRemainingSql = `CASE WHEN o.payment_status = 'lunas' THEN 0
  ELSE GREATEST(COALESCE(o.payment_days_target, 0) - COALESCE(o.payment_days_total, 0), 0) END`

app.get('/orders', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit
    const customerName = typeof req.query.customer_name === 'string' ? req.query.customer_name.trim() : ''
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    let resellerId = null
    if (actor.role === 'reseller') resellerId = actor.id
    else if (req.query.reseller_id != null && req.query.reseller_id !== '') resellerId = parseInt(req.query.reseller_id, 10) || null

    const parts = []
    const params = []
    if (customerName !== '') {
      parts.push('c.name LIKE ?')
      params.push(`%${customerName}%`)
    } else if (q !== '') {
      parts.push("(c.name LIKE ? OR c.phone LIKE ? OR r.name LIKE ? OR DATE_FORMAT(o.order_date, '%Y-%m-%d') LIKE ?)")
      const like = `%${q}%`
      params.push(like, like, like, like)
    }
    if (resellerId) {
      parts.push('o.reseller_id = ?')
      params.push(resellerId)
    }
    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : ''
    const countSql = `SELECT COUNT(*) AS c FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN resellers r ON r.id=o.reseller_id ${where}`
    const [[cnt]] = await pool.query(countSql, params)
    const total = Number(cnt.c)
    const sql = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
      r.name AS reseller_name, o.payment_period,
      GREATEST(o.total_amount - o.amount_paid, 0) AS remaining_amount,
      ${daysRemainingSql} AS payment_days_remaining
      FROM orders o
      JOIN customers c ON c.id=o.customer_id
      LEFT JOIN resellers r ON r.id=o.reseller_id
      ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`
    const [rows] = await pool.query(sql, [...params, limit, offset])
    json(res, rows, 200, {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat order', 500)
  }
})

app.post('/orders_save', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  const conn = await pool.getConnection()
  try {
    const body = req.body || {}
    let orderId = parseInt(body.id, 10) || 0
    const isUpdate = orderId > 0

    let resellerId = null
    if (actor.role === 'reseller') resellerId = actor.id
    else if (body.reseller_id != null && body.reseller_id !== '') resellerId = parseInt(body.reseller_id, 10) || null

    const customerName = (body.customer_name || '').trim()
    const customerPhone = (body.customer_phone || '').trim()
    const customerAddress = (body.customer_address || '').trim()
    const paymentStatus = body.payment_status === 'lunas' ? 'lunas' : 'belum_lunas'
    let paymentDaysTotal = Math.max(0, parseInt(body.payment_days_total, 10) || 0)
    const amountPaidInput = parseFloat(body.amount_paid) || 0
    const items = Array.isArray(body.items) ? body.items : []
    const paymentPeriod =
      typeof body.payment_period === 'string' && PERIOD_MULTIPLIERS[body.payment_period]
        ? body.payment_period
        : null

    if (!customerName || !items.length) {
      conn.release()
      return err(res, 'Data tidak lengkap', 422)
    }

    if (!isUpdate && !paymentPeriod) {
      conn.release()
      return err(res, 'Periode pembayaran wajib dipilih', 422)
    }
    if (!isUpdate && paymentPeriod === 'legacy') {
      conn.release()
      return err(res, 'Periode pembayaran tidak valid untuk order baru', 422)
    }

    await conn.beginTransaction()

    let customerId = 0
    let existingPeriod = null
    if (isUpdate) {
      const [existRows] = await conn.query('SELECT customer_id, reseller_id, payment_period FROM orders WHERE id = ?', [orderId])
      const existing = existRows[0]
      if (!existing) throw new Error('Order tidak ditemukan')
      if (actor.role === 'reseller' && parseInt(existing.reseller_id, 10) !== actor.id) throw new Error('Order tidak ditemukan')
      existingPeriod = existing.payment_period || null
      customerId = parseInt(existing.customer_id, 10)
      await conn.query('UPDATE customers SET reseller_id=?, name=?, phone=?, address=?, updated_at=NOW() WHERE id=?', [
        resellerId,
        customerName,
        customerPhone,
        customerAddress,
        customerId,
      ])
    } else {
      const [ins] = await conn.query(
        'INSERT INTO customers (reseller_id, name, phone, address, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())',
        [resellerId, customerName, customerPhone, customerAddress],
      )
      customerId = ins.insertId
    }

    const periodToStore = paymentPeriod || existingPeriod
    if (!periodToStore || !PERIOD_MULTIPLIERS[periodToStore]) {
      throw new Error('Periode pembayaran wajib dipilih')
    }
    const M2 = periodMultiplier(periodToStore)

    let total = 0
    let paymentDaysTarget = 0
    const normalized = []
    for (const item of items) {
      const pid = parseInt(item.product_id, 10) || 0
      const qty = Math.max(1, parseInt(item.qty, 10) || 1)
      const [pRows] = await conn.query('SELECT price, payment_days_total FROM products WHERE id = ?', [pid])
      const p = pRows[0]
      if (!p) throw new Error('Produk tidak ditemukan')
      const price = parseFloat(p.price)
      const prodDays = parseInt(p.payment_days_total, 10) || 0
      const subtotal = price * qty * M2
      total += subtotal
      paymentDaysTarget += qty * prodDays * M2
      normalized.push([pid, qty, price, subtotal])
    }

    let amountPaid = paymentStatus === 'lunas' ? total : Math.min(Math.max(amountPaidInput, 0), total)
    if (paymentStatus === 'belum_lunas' && amountPaid > total) throw new Error('Total uang dibayar tidak boleh lebih dari total order')

    if (isUpdate) {
      await conn.query(
        'UPDATE orders SET reseller_id=?, total_amount=?, payment_status=?, payment_days_total=?, payment_days_target=?, amount_paid=?, payment_period=?, updated_at=NOW() WHERE id=?',
        [resellerId, total, paymentStatus, paymentDaysTotal, paymentDaysTarget, amountPaid, periodToStore, orderId],
      )
      await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId])
    } else {
      const [ins] = await conn.query(
        `INSERT INTO orders (customer_id, reseller_id, order_date, total_amount, payment_status, payment_days_total, payment_days_target, amount_paid, payment_period, created_at, updated_at)
         VALUES (?,?,CURDATE(),?,?,?,?,?,?,NOW(),NOW())`,
        [customerId, resellerId, total, paymentStatus, paymentDaysTotal, paymentDaysTarget, amountPaid, periodToStore],
      )
      orderId = ins.insertId
    }

    const oi = 'INSERT INTO order_items(order_id, product_id, qty, price, subtotal, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())'
    for (const [pid, qty, price, subtotal] of normalized) {
      await conn.query(oi, [orderId, pid, qty, price, subtotal])
    }

    await conn.commit()
    conn.release()
    json(res, { id: orderId, message: isUpdate ? 'Order diupdate' : 'Order ditambah' })
  } catch (e) {
    await conn.rollback()
    conn.release()
    const msg = e instanceof Error ? e.message : 'Gagal menyimpan order'
    const status = /tidak|lengkap|wajib/i.test(msg) ? 422 : 500
    err(res, status === 422 ? msg : 'Gagal menyimpan order', status)
  }
})

app.get('/orders_detail', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    const id = parseInt(req.query.id, 10) || 0
    if (id <= 0) return err(res, 'ID tidak valid', 422)
    const sql = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
      r.name AS reseller_name, o.payment_period,
      GREATEST(o.total_amount - o.amount_paid, 0) AS remaining_amount,
      ${daysRemainingSql} AS payment_days_remaining
      FROM orders o JOIN customers c ON c.id = o.customer_id
      LEFT JOIN resellers r ON r.id = o.reseller_id
      WHERE o.id = ? LIMIT 1`
    const [[order]] = await pool.query(sql, [id])
    if (!order) return err(res, 'Order tidak ditemukan', 404)
    if (actor.role === 'reseller' && parseInt(order.reseller_id, 10) !== actor.id) return err(res, 'Forbidden', 403)
    const [items] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.payment_days_total AS product_payment_days_total
       FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id ASC`,
      [id],
    )
    order.items = items
    json(res, order)
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat detail', 500)
  }
})

app.post('/orders_delete', async (req, res) => {
  if (!authAdmin(req, res)) return
  const conn = await pool.getConnection()
  try {
    const id = parseInt((req.body || {}).id, 10) || 0
    if (id <= 0) return err(res, 'ID tidak valid', 422)
    const [[row]] = await conn.query('SELECT customer_id FROM orders WHERE id = ?', [id])
    const customerId = row ? parseInt(row.customer_id, 10) : 0
    await conn.beginTransaction()
    await conn.query('DELETE FROM orders WHERE id = ?', [id])
    if (customerId > 0) await conn.query('DELETE FROM customers WHERE id = ?', [customerId])
    await conn.commit()
    conn.release()
    json(res, { deleted: true })
  } catch (e) {
    await conn.rollback()
    conn.release()
    err(res, 'Gagal menghapus order', 500)
  }
})

app.get('/resellers', async (req, res) => {
  if (!authAdmin(req, res)) return
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 10))
    const offset = (page - 1) * limit
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    let where = ''
    const params = []
    if (q !== '') {
      where = ' WHERE r.name LIKE ? OR r.phone LIKE ? OR r.address LIKE ?'
      const like = `%${q}%`
      params.push(like, like, like)
    }
    const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM resellers r ${where}`, params)
    const total = Number(countRows[0].c)
    const sql = `SELECT r.*,
      COUNT(DISTINCT o.id) AS total_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_order_amount,
      COALESCE(SUM(o.amount_paid), 0) AS total_uang_masuk,
      COALESCE(SUM(GREATEST(o.total_amount - o.amount_paid, 0)), 0) AS total_sisa_bayar
      FROM resellers r LEFT JOIN orders o ON o.reseller_id = r.id
      ${where} GROUP BY r.id ORDER BY r.id DESC LIMIT ? OFFSET ?`
    const [rows] = await pool.query(sql, [...params, limit, offset])
    json(res, rows, 200, {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat reseller', 500)
  }
})

app.post('/resellers_save', async (req, res) => {
  if (!authAdmin(req, res)) return
  try {
    const body = req.body || {}
    let id = parseInt(body.id, 10) || 0
    const name = (body.name || '').trim()
    const phone = (body.phone || '').trim()
    const address = (body.address || '').trim()
    const loginUsername = (body.login_username || '').trim()
    const password = typeof body.password === 'string' ? body.password : ''

    if (id > 0) {
      const [[cur]] = await pool.query('SELECT login_username FROM resellers WHERE id = ?', [id])
      const currentLogin = cur?.login_username ? String(cur.login_username) : ''
      const targetLogin = loginUsername !== '' ? loginUsername : currentLogin
      if (targetLogin !== '') {
        const [dup] = await pool.query('SELECT id FROM resellers WHERE login_username = ? AND id <> ? LIMIT 1', [targetLogin, id])
        if (dup.length) return err(res, 'Username login sudah dipakai', 422)
      }
      if (password !== '') {
        if (!targetLogin) return err(res, 'Isi username login sebelum mengatur password', 422)
        const hash = await bcrypt.hash(password, 10)
        await pool.query(
          'UPDATE resellers SET name=?, phone=?, address=?, login_username=?, password_hash=?, updated_at=NOW() WHERE id=?',
          [name, phone, address, targetLogin, hash, id],
        )
      } else if (loginUsername !== '' && loginUsername !== currentLogin) {
        await pool.query('UPDATE resellers SET name=?, phone=?, address=?, login_username=?, updated_at=NOW() WHERE id=?', [
          name,
          phone,
          address,
          loginUsername,
          id,
        ])
      } else {
        await pool.query('UPDATE resellers SET name=?, phone=?, address=?, updated_at=NOW() WHERE id=?', [name, phone, address, id])
      }
      return json(res, { id })
    }

    if (loginUsername !== '') {
      const [dup] = await pool.query('SELECT id FROM resellers WHERE login_username = ? LIMIT 1', [loginUsername])
      if (dup.length) return err(res, 'Username login sudah dipakai', 422)
    }
    if (password !== '' && !loginUsername) return err(res, 'Username login wajib jika mengisi password', 422)
    const hash = password !== '' ? await bcrypt.hash(password, 10) : null
    const [ins] = await pool.query(
      'INSERT INTO resellers(name, phone, address, login_username, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())',
      [name, phone, address, loginUsername || null, hash],
    )
    json(res, { id: ins.insertId })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menyimpan reseller', 500)
  }
})

app.post('/resellers_delete', async (req, res) => {
  if (!authAdmin(req, res)) return
  try {
    const id = parseInt((req.body || {}).id, 10) || 0
    await pool.query('DELETE FROM resellers WHERE id = ?', [id])
    json(res, { deleted: true })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menghapus reseller', 500)
  }
})

app.get('/reseller_orders', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    let resellerId =
      actor.role === 'reseller' ? actor.id : parseInt(req.query.reseller_id, 10) || 0
    if (resellerId <= 0) return err(res, 'ID reseller tidak valid', 422)
    const [[reseller]] = await pool.query('SELECT id, name FROM resellers WHERE id = ? LIMIT 1', [resellerId])
    if (!reseller) return err(res, 'Reseller tidak ditemukan', 404)
    const [orders] = await pool.query(
      `SELECT o.id, o.order_date, o.total_amount, o.payment_status, o.payment_days_total, o.payment_days_target,
       o.amount_paid, o.payment_period,
       GREATEST(o.total_amount - o.amount_paid, 0) AS remaining_amount,
       CASE WHEN o.payment_status = 'lunas' THEN 0
         ELSE GREATEST(COALESCE(o.payment_days_target,0)-COALESCE(o.payment_days_total,0),0) END AS payment_days_remaining,
       c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.reseller_id = ? ORDER BY o.order_date DESC, o.id DESC`,
      [resellerId],
    )
    json(res, { reseller, orders })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat order reseller', 500)
  }
})

app.post('/reseller_order_payment_save', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    const body = req.body || {}
    const orderId = parseInt(body.order_id, 10) || 0
    const amountPaidInput = parseFloat(body.amount_paid) || 0
    const paymentDaysTotal = Math.max(0, parseInt(body.payment_days_total, 10) || 0)
    if (orderId <= 0) return err(res, 'ID order tidak valid', 422)
    const [[order]] = await pool.query('SELECT id, total_amount, reseller_id FROM orders WHERE id = ?', [orderId])
    if (!order) return err(res, 'Order tidak ditemukan', 404)
    if (!parseInt(order.reseller_id, 10)) return err(res, 'Order ini bukan order reseller', 422)
    if (actor.role === 'reseller' && parseInt(order.reseller_id, 10) !== actor.id) return err(res, 'Forbidden', 403)
    const totalAmount = parseFloat(order.total_amount)
    const amountPaid = Math.min(Math.max(amountPaidInput, 0), totalAmount)
    const paymentStatus = amountPaid >= totalAmount ? 'lunas' : 'belum_lunas'
    await pool.query(
      'UPDATE orders SET amount_paid = ?, payment_days_total = ?, payment_status = ?, updated_at = NOW() WHERE id = ?',
      [amountPaid, paymentDaysTotal, paymentStatus, orderId],
    )
    json(res, { order_id: orderId, amount_paid: amountPaid, payment_days_total: paymentDaysTotal, payment_status: paymentStatus })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menyimpan pembayaran', 500)
  }
})

app.get('/transactions', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const offset = (page - 1) * limit
    const year = Math.max(2000, parseInt(req.query.year, 10) || new Date().getFullYear())
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    let resellerFilter = null
    if (actor.role === 'reseller') resellerFilter = actor.id
    else if (req.query.reseller_id != null && req.query.reseller_id !== '') resellerFilter = parseInt(req.query.reseller_id, 10) || null

    const parts = ['d.deposit_date >= ?', 'd.deposit_date <= ?']
    const params = [start, end]
    if (resellerFilter) {
      parts.push('d.reseller_id = ?')
      params.push(resellerFilter)
    }
    const where = 'WHERE ' + parts.join(' AND ')
    const [[cnt]] = await pool.query(`SELECT COUNT(*) AS c FROM reseller_deposits d ${where}`, params)
    const total = Number(cnt.c)
    const [rows] = await pool.query(
      `SELECT d.*, r.name AS reseller_name FROM reseller_deposits d
       JOIN resellers r ON r.id = d.reseller_id ${where}
       ORDER BY d.deposit_date DESC, d.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    )
    json(res, rows, 200, {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
      year,
    })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat transaksi', 500)
  }
})

app.post('/transaction_save', uploadDeposit.single('proof'), async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    const body = req.body || {}
    const id = parseInt(body.id, 10) || 0
    const depositDate = body.deposit_date || body.depositDate
    const amount = parseFloat(body.amount) || 0
    const paymentMethod = body.payment_method === 'transfer' ? 'transfer' : 'cash'
    let resellerId =
      actor.role === 'reseller'
        ? actor.id
        : parseInt(body.reseller_id, 10) || 0
    if (actor.role === 'admin' && !resellerId) return err(res, 'Reseller wajib dipilih', 422)
    if (resellerId <= 0) return err(res, 'Reseller tidak valid', 422)
    const proof = req.file ? `/uploads/${DEPOSIT_UPLOAD_SUB}/${req.file.filename}` : null

    if (!depositDate || amount <= 0) return err(res, 'Tanggal dan jumlah setoran wajib diisi', 422)

    if (id > 0) {
      const [[row]] = await pool.query('SELECT reseller_id, proof_image_path FROM reseller_deposits WHERE id = ?', [id])
      if (!row) return err(res, 'Transaksi tidak ditemukan', 404)
      if (actor.role === 'reseller' && parseInt(row.reseller_id, 10) !== actor.id) return err(res, 'Forbidden', 403)
      const rid = actor.role === 'admin' ? resellerId : parseInt(row.reseller_id, 10)
      const imagePath = proof || row.proof_image_path
      await pool.query(
        'UPDATE reseller_deposits SET reseller_id=?, deposit_date=?, amount=?, payment_method=?, proof_image_path=?, updated_at=NOW() WHERE id=?',
        [rid, depositDate, amount, paymentMethod, imagePath, id],
      )
      if (proof && row.proof_image_path && row.proof_image_path !== proof) unlinkRelPaths(row.proof_image_path)
      return json(res, { id })
    }

    const [ins] = await pool.query(
      `INSERT INTO reseller_deposits (reseller_id, deposit_date, amount, payment_method, proof_image_path, created_at, updated_at)
       VALUES (?,?,?,?,?,NOW(),NOW())`,
      [resellerId, depositDate, amount, paymentMethod, proof],
    )
    json(res, { id: ins.insertId })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal menyimpan setoran', 500)
  }
})

app.get('/reports', async (req, res) => {
  const actor = authRoles(req, res, ['admin', 'reseller'])
  if (!actor) return
  try {
    const year = Math.max(2000, parseInt(req.query.year, 10) || new Date().getFullYear())
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    let resellerId = null
    if (actor.role === 'reseller') resellerId = actor.id
    else if (req.query.reseller_id != null && req.query.reseller_id !== '') resellerId = parseInt(req.query.reseller_id, 10) || null

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 500))
    const offset = (page - 1) * limit
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    const orderCond = ['o.order_date BETWEEN ? AND ?']
    const orderParams = [start, end]
    if (resellerId) {
      orderCond.push('o.reseller_id = ?')
      orderParams.push(resellerId)
    }
    if (q !== '') {
      orderCond.push('c.name LIKE ?')
      orderParams.push(`%${q}%`)
    }
    const orderWhere = 'WHERE ' + orderCond.join(' AND ')

    const depositCond = ['d.deposit_date BETWEEN ? AND ?']
    const depositParams = [start, end]
    if (resellerId) {
      depositCond.push('d.reseller_id = ?')
      depositParams.push(resellerId)
    }
    const depositWhere = 'WHERE ' + depositCond.join(' AND ')

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM orders o JOIN customers c ON c.id = o.customer_id LEFT JOIN resellers r ON r.id = o.reseller_id ${orderWhere}`,
      orderParams,
    )
    const total = Number(countRow.c)

    const [[summary]] = await pool.query(
      `SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS sum_total_amount,
        COALESCE(SUM(o.amount_paid), 0) AS sum_amount_paid,
        COALESCE(SUM(GREATEST(o.total_amount - o.amount_paid, 0)), 0) AS sum_remaining_amount,
        SUM(CASE WHEN o.payment_status = 'belum_lunas' THEN 1 ELSE 0 END) AS count_belum_lunas,
        SUM(CASE WHEN o.payment_status = 'lunas' THEN 1 ELSE 0 END) AS count_lunas
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN resellers r ON r.id = o.reseller_id
      ${orderWhere}`,
      orderParams,
    )

    const [[depSum]] = await pool.query(
      `SELECT COALESCE(SUM(d.amount), 0) AS sum_deposits FROM reseller_deposits d ${depositWhere}`,
      depositParams,
    )

    const sumDeposits = parseFloat(depSum.sum_deposits) || 0
    const sumAmountPaid = parseFloat(summary.sum_amount_paid) || 0
    const selisihPembayaranSetoran = sumAmountPaid - sumDeposits

    const sql = `SELECT o.id, o.order_date, o.total_amount, o.amount_paid, o.payment_days_total, o.payment_days_target,
      o.payment_status, o.payment_period,
      GREATEST(o.total_amount - o.amount_paid, 0) AS remaining_amount,
      ${daysRemainingSql} AS payment_days_remaining,
      c.name AS customer_name, c.phone AS customer_phone,
      r.name AS reseller_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN resellers r ON r.id = o.reseller_id
      ${orderWhere}
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT ${limit} OFFSET ${offset}`

    const [rows] = await pool.query(sql, orderParams)
    json(res, rows, 200, {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
      year,
      summary: {
        order_count: parseInt(summary.order_count, 10) || 0,
        sum_total_amount: parseFloat(summary.sum_total_amount) || 0,
        sum_amount_paid: sumAmountPaid,
        sum_remaining_amount: parseFloat(summary.sum_remaining_amount) || 0,
        count_belum_lunas: parseInt(summary.count_belum_lunas, 10) || 0,
        count_lunas: parseInt(summary.count_lunas, 10) || 0,
        sum_deposits: sumDeposits,
        selisih_pembayaran_anggota_vs_setoran: selisihPembayaranSetoran,
      },
    })
  } catch (e) {
    console.error(e)
    err(res, 'Gagal memuat laporan', 500)
  }
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

async function bootstrap() {
  await ensureUploadDirs()
  app.listen(PORT, () => {
    console.log(`API listening on http://127.0.0.1:${PORT}`)
  })
}

bootstrap().catch((e) => {
  console.error('Failed to start server:', e)
  process.exit(1)
})

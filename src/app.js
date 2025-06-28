import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
const app = express()
//To define the origin and allow the origin to share resources
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
//To tell the browser that I will accept json
app.use(express.json({
    limit: "16kb"
}))
//To take data from URL's
app.use(express.urlencoded({extended: true}))
//A Directory to store static data
app.use(express.static("public"))
//To perform CRUD operation on the cookie that is saved in users browser
app.use(cookieParser())
export {app}
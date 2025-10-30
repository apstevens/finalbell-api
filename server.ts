import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ["https://finalbell.co.uk", "https://www.finalbell.co.uk"], credentials: true }));

app.get('/healthz', (_req, res) => res.send('OK'));


const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => console.log(`API Listening on ${PORT}`));

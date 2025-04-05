import { generateMessageFromProfileUrlAPI } from './../controllers/personalized-message.controller';
import express from 'express';
import {
  generateMessageFromProfileData,
  generateMessageFromProfileUrl
} from '../controllers/personalized-message.controller';

const router = express.Router();

router.post('/', generateMessageFromProfileData);
router.post('/from-url', generateMessageFromProfileUrl);
router.post("/from-url-api", generateMessageFromProfileUrlAPI);
export default router;
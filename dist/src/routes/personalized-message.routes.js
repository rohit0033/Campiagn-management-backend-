"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const personalized_message_controller_1 = require("./../controllers/personalized-message.controller");
const express_1 = __importDefault(require("express"));
const personalized_message_controller_2 = require("../controllers/personalized-message.controller");
const router = express_1.default.Router();
router.post('/', personalized_message_controller_2.generateMessageFromProfileData);
router.post('/from-url', personalized_message_controller_2.generateMessageFromProfileUrl);
router.post("/from-url-api", personalized_message_controller_1.generateMessageFromProfileUrlAPI);
exports.default = router;

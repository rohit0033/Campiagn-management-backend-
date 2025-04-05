"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const leads_controller_1 = require("../controllers/leads.controller");
const router = express_1.default.Router();
// Get all leads
router.get('/', leads_controller_1.getLeads);
// Get a lead by ID
router.get('/:id', leads_controller_1.getLeadById);
// Get a lead by LinkedIn URL
router.get('/url/:url', leads_controller_1.getLeadsByUrl);
exports.default = router;

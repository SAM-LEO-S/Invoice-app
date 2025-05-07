import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const app = express();
const PORT = 4000;
const SECRET = 'your_jwt_secret';
const USERS_FILE = './users.json';
const PDF_DIR = './pdfs';

app.use(cors());
app.use(bodyParser.json());
app.use('/pdfs', express.static(PDF_DIR));

// --- Helper functions ---
const loadUsers = () => {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        return [];
    }
};
const saveUsers = (users) => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

const loadMeta = () => {
    try {
        return fs.existsSync('./pdfs/meta.json') ? JSON.parse(fs.readFileSync('./pdfs/meta.json')) : [];
    } catch (error) {
        console.error('Error loading metadata:', error);
        return [];
    }
};
const saveMeta = (meta) => fs.writeFileSync('./pdfs/meta.json', JSON.stringify(meta, null, 2));

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- Auth Endpoints ---
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'User exists' });
    const hashed = await bcrypt.hash(password, 10);
    users.push({ username, password: hashed });
    saveUsers(users);
    res.json({ success: true });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (!(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ username }, SECRET, { expiresIn: '1d' });
    res.json({ token });
});

// --- PDF Generation Endpoint ---
app.post('/generate-invoice', authenticateToken, async (req, res) => {
    const data = req.body;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const blue = rgb(0.18, 0.36, 0.7);
    const lightBlue = rgb(0.93, 0.96, 1);
    const altRow = rgb(0.97, 0.98, 1);
    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const tableBorderWidth = 0.8;

    // Full-page border
    const borderMargin = 20;
    const borderWidth = 2;
    page.drawRectangle({
        x: borderMargin,
        y: borderMargin,
        width: pageWidth - 2 * borderMargin,
        height: pageHeight - 2 * borderMargin,
        borderColor: blue,
        borderWidth: borderWidth,
    });

    // Header (blue background)
    const headerHeight = 40;
    page.drawRectangle({
        x: borderMargin,
        y: pageHeight - borderMargin - headerHeight,
        width: pageWidth - 2 * borderMargin,
        height: headerHeight,
        color: blue,
    });

    // Logo placeholder (ellipse)
    const logoX = borderMargin + 35;
    const logoY = pageHeight - borderMargin - headerHeight / 2;
    const logoRadiusX = 20;
    const logoRadiusY = 20;
    page.drawEllipse({
        x: logoX,
        y: logoY + 5, // Adjust vertical position slightly
        xScale: logoRadiusX,
        yScale: logoRadiusY,
        borderColor: rgb(0.8, 0.2, 0.2),
        borderWidth: 1.2,
    });

    // School name and address
    const schoolNameX = logoX + logoRadiusX + 15;
    page.drawText('JOYFUL KINGDOM OF MONTESSORRI', {
        x: schoolNameX,
        y: pageHeight - borderMargin - 23,
        size: 16,
        font: fontBold,
        color: white,
    });
    page.drawText('Kamatchiamman Nager, Chikkarayapuram, Kovur EB, Chennai – 69', {
        x: schoolNameX,
        y: pageHeight - borderMargin - 38,
        size: 10,
        font,
        color: white,
    });
    page.drawText('Ph : 7904821929 / 9176562749', {
        x: pageWidth - borderMargin - 180,
        y: pageHeight - borderMargin - 38,
        size: 10,
        font,
        color: white,
    });

    // Section divider
    const dividerY = pageHeight - borderMargin - headerHeight - 15;
    page.drawLine({
        start: { x: borderMargin + 10, y: dividerY },
        end: { x: pageWidth - borderMargin - 10, y: dividerY },
        thickness: 1.5,
        color: blue,
    });

    // Title
    page.drawText('RECEIPT', {
        x: pageWidth / 2 - 30,
        y: dividerY - 20,
        size: 18,
        font: fontBold,
        color: blue,
    });

    // Student details table
    const studentTableX = borderMargin + 10;
    const studentTableY = dividerY - 40;
    const studentCellHeight = 20;
    const studentCellWidths = [100, 80, 80, 80, 135];
    const studentHeaders = ['NAME', 'NUMBER', 'TERM', 'CLASS', 'DATE'];
    const studentData = [
        data.studentName || '',
        data.number || '',
        data.term || '',
        data.className || '',
        data.date || '',
    ];

    // Draw table border
    page.drawRectangle({
        x: studentTableX,
        y: studentTableY,
        width: studentCellWidths.reduce((sum, width) => sum + width, 0),
        height: -2 * studentCellHeight,
        borderColor: blue,
        borderWidth: tableBorderWidth,
    });

    // Draw header row background
    page.drawRectangle({
        x: studentTableX,
        y: studentTableY,
        width: studentCellWidths.reduce((sum, width) => sum + width, 0),
        height: -studentCellHeight,
        color: lightBlue,
    });

    let currentX = studentTableX;
    // Draw header cells
    studentHeaders.forEach((header, index) => {
        page.drawText(header, {
            x: currentX + studentCellWidths[index] / 2 - (fontBold.widthOfTextAtSize(header, 10) / 2),
            y: studentTableY - 14,
            size: 10,
            font: fontBold,
            color: blue,
        });
        currentX += studentCellWidths[index];
        page.drawLine({
            start: { x: currentX, y: studentTableY },
            end: { x: currentX, y: studentTableY - 2 * studentCellHeight },
            thickness: tableBorderWidth,
            color: blue,
        });
    });
    page.drawLine({
        start: { x: studentTableX, y: studentTableY },
        end: { x: currentX, y: studentTableY },
        thickness: tableBorderWidth,
        color: blue,
    });
    page.drawLine({
        start: { x: studentTableX, y: studentTableY - studentCellHeight },
        end: { x: currentX, y: studentTableY - studentCellHeight },
        thickness: tableBorderWidth,
        color: blue,
    });
    page.drawLine({
        start: { x: studentTableX, y: studentTableY - 2 * studentCellHeight },
        end: { x: currentX, y: studentTableY - 2 * studentCellHeight },
        thickness: tableBorderWidth,
        color: blue,
    });


    // Draw data row
    currentX = studentTableX;
    studentData.forEach((item, index) => {
        page.drawText(item, {
            x: currentX + 5,
            y: studentTableY - studentCellHeight - 14,
            size: 10,
            font,
            color: black,
        });
        currentX += studentCellWidths[index];
    });

    // Payment details table
    const paymentTableX = borderMargin + 10;
    const paymentTableY = studentTableY - 2 * studentCellHeight - 15;
    const paymentCellHeight = 20;
    const paymentCellWidths = [165, 170, 170]; // 3 columns
    const paymentHeaders = ['By cash / cheque / D.D No.', 'Drawn', 'Branch'];
    const paymentData = [data.paymentMethod || '', data.drawn || '', data.branch || ''];

    // Draw table border
    page.drawRectangle({
        x: paymentTableX,
        y: paymentTableY,
        width: paymentCellWidths.reduce((sum, width) => sum + width, 0),
        height: -paymentCellHeight * 2, // header + data row
        borderColor: blue,
        borderWidth: tableBorderWidth,
    });

    // Draw header row background
    page.drawRectangle({
        x: paymentTableX,
        y: paymentTableY,
        width: paymentCellWidths.reduce((sum, width) => sum + width, 0),
        height: -paymentCellHeight,
        color: lightBlue,
    });

    // Draw header cells
    currentX = paymentTableX;
    paymentHeaders.forEach((header, index) => {
        page.drawText(header, {
            x: currentX + paymentCellWidths[index] / 2 - (fontBold.widthOfTextAtSize(header, 10) / 2),
            y: paymentTableY - 14,
            size: 10,
            font: fontBold,
            color: blue,
        });
        currentX += paymentCellWidths[index];
        page.drawLine({
            start: { x: currentX, y: paymentTableY },
            end: { x: currentX, y: paymentTableY - paymentCellHeight * 2 },
            thickness: tableBorderWidth,
            color: blue,
        });
    });
    page.drawLine({
        start: { x: paymentTableX, y: paymentTableY },
        end: { x: currentX, y: paymentTableY },
        thickness: tableBorderWidth,
        color: blue,
    });
    page.drawLine({
        start: { x: paymentTableX, y: paymentTableY - paymentCellHeight },
        end: { x: currentX, y: paymentTableY - paymentCellHeight },
        thickness: tableBorderWidth,
        color: blue,
    });
    page.drawLine({
        start: { x: paymentTableX, y: paymentTableY - paymentCellHeight * 2 },
        end: { x: currentX, y: paymentTableY - paymentCellHeight * 2 },
        thickness: tableBorderWidth,
        color: blue,
    });

    // Draw data row
    currentX = paymentTableX;
    paymentData.forEach((item, index) => {
        page.drawText(item, {
            x: currentX + paymentCellWidths[index] / 2 - (font.widthOfTextAtSize(item, 10) / 2),
            y: paymentTableY - paymentCellHeight - 14,
            size: 10,
            font,
            color: black,
        });
        currentX += paymentCellWidths[index];
    });

    // Fees table
    const feesTableX = borderMargin + 10;
    const feesTableY = paymentTableY - paymentCellHeight - 25;
    const feesCellHeight = 20;
    const feesCellWidths = [395, 120];
    const feesHeaders = ['Fees', 'Amount'];
    const feeItems = data.fees || [];
    const visibleFeeItems = feeItems.slice(0, 5);
    const totalFeeRows = visibleFeeItems.length + 2; // For items + total + amount in words

    // Draw table border
    page.drawRectangle({
        x: feesTableX,
        y: feesTableY,
        width: feesCellWidths.reduce((sum, width) => sum + width, 0),
        height: -totalFeeRows * feesCellHeight,
        borderColor: blue,
        borderWidth: tableBorderWidth,
    });

    // Draw header row background
    page.drawRectangle({
        x: feesTableX,
        y: feesTableY,
        width: feesCellWidths.reduce((sum, width) => sum + width, 0),
        height: -feesCellHeight,
        color: lightBlue,
    });

    currentX = feesTableX;
    // Draw header cells
    feesHeaders.forEach((header, index) => {
        page.drawText(header, {
            x: currentX + feesCellWidths[index] / 2 - (fontBold.widthOfTextAtSize(header, 10) / 2),
            y: feesTableY - 14,
            size: 10,
            font: fontBold,
            color: blue,
        });
        currentX += feesCellWidths[index];
        page.drawLine({
            start: { x: currentX, y: feesTableY },
            end: { x: currentX, y: feesTableY - totalFeeRows * feesCellHeight },
            thickness: tableBorderWidth,
            color: blue,
        });
    });
    page.drawLine({
        start: { x: feesTableX, y: feesTableY },
        end: { x: currentX, y: feesTableY },
        thickness: tableBorderWidth,
        color: blue,
    });
    page.drawLine({
        start: { x: feesTableX, y: feesTableY - feesCellHeight },
        end: { x: currentX, y: feesTableY - feesCellHeight },
        thickness: tableBorderWidth,
        color: blue,
    });

    // Draw fee items
    let currentY = feesTableY - feesCellHeight;
    visibleFeeItems.forEach((fee, index) => {
        if (index % 2 === 1) {
            page.drawRectangle({
                x: feesTableX,
                y: currentY,
                width: feesCellWidths.reduce((sum, width) => sum + width, 0),
                height: -feesCellHeight,
                color: altRow,
            });
        }
        page.drawText(fee.label || '', { x: feesTableX + 5, y: currentY - 14, size: 10, font, color: black });
        page.drawText(fee.amount || '', {
            x: feesTableX + feesCellWidths[0] + 5,
            y: currentY - 14,
            size: 10,
            font,
            color: black,
        });
        page.drawLine({ start: { x: feesTableX, y: currentY }, end: { x: feesTableX + feesCellWidths.reduce((sum, width) => sum + width, 0), y: currentY }, thickness: tableBorderWidth,
        color: blue,
    });
        currentY -= feesCellHeight;
    });

    // Total amount
    page.drawRectangle({
        x: feesTableX,
        y: currentY,
        width: feesCellWidths.reduce((sum, width) => sum + width, 0),
        height: -feesCellHeight,
        color: lightBlue,
    });
    page.drawText('Total Amount:', {
        x: feesTableX + feesCellWidths[0] - 80,
        y: currentY - 14,
        size: 10,
        font: fontBold,
        color: blue,
    });
    page.drawText(data.totalAmount || '', {
        x: feesTableX + feesCellWidths[0] + 5,
        y: currentY - 14,
        size: 10,
        font: fontBold,
        color: blue,
    });
    page.drawLine({ start: { x: feesTableX, y: currentY }, end: { x: feesTableX + feesCellWidths.reduce((sum, width) => sum + width, 0), y: currentY }, thickness: tableBorderWidth, color: blue });
    currentY -= feesCellHeight;

    // Amount in words
    page.drawText('Amount in Words:', { x: feesTableX + 5, y: currentY - 14, size: 10, font: fontBold, color: blue });
    page.drawText(data.amountInWords || '', { x: feesTableX + 110, y: currentY - 14, size: 10, font, color: blue });
    page.drawLine({
        start: { x: feesTableX, y: currentY },
        end: { x: feesTableX + feesCellWidths.reduce((sum, width) => sum + width, 0), y: currentY },
        thickness: tableBorderWidth,
        color: blue,
    });

    // Denominations table
    const denomTableX = borderMargin + 10;
    const denomTableY = feesTableY - totalFeeRows * feesCellHeight - 25;
    const denomCellHeight = 20;
    const denomCellWidths = [115, 115, 115];
    const denomHeaders = ['Denomination', 'Count', 'Amount'];
    const standardDenoms = [2000, 500, 200, 100, 50, 20, 10];
    const denomRows = standardDenoms.length;

    // Draw table border
    page.drawRectangle({
        x: denomTableX,
        y: denomTableY,
        width: denomCellWidths.reduce((sum, width) => sum + width, 0),
        height: -denomRows * denomCellHeight,
        borderColor: blue,
        borderWidth: tableBorderWidth,
    });

    // Draw header row background
    page.drawRectangle({
        x: denomTableX,
        y: denomTableY,
        width: denomCellWidths.reduce((sum, width) => sum + width, 0),
        height: -denomCellHeight,
        color: lightBlue,
    });

    currentX = denomTableX;
    // Draw header cells
    denomHeaders.forEach((header, index) => {
        page.drawText(header, {
            x: currentX + denomCellWidths[index] / 2 - (fontBold.widthOfTextAtSize(header, 10) / 2),
            y: denomTableY - 14,
            size: 10,
            font: fontBold,
            color: blue,
        });
        currentX += denomCellWidths[index];
        page.drawLine({
            start: { x: currentX, y: denomTableY },
            end: { x: currentX, y: denomTableY - denomRows * denomCellHeight },
            thickness: tableBorderWidth,
            color: blue,
        });
    });
    page.drawLine({
        start: { x: denomTableX, y: denomTableY },
        end: { x: currentX, y: denomTableY },
        thickness: tableBorderWidth,
        color: blue,
    });
    page.drawLine({
        start: { x: denomTableX, y: denomTableY - denomCellHeight },
        end: { x: currentX, y: denomTableY - denomCellHeight },
        thickness: tableBorderWidth,
        color: blue,
    });

    // Draw denomination rows
    currentY = denomTableY - denomCellHeight;
    standardDenoms.forEach((denom, index) => {
        if (index % 2 === 1) {
            page.drawRectangle({
                x: denomTableX,
                y: currentY,
                width: denomCellWidths.reduce((sum, width) => sum + width, 0),
                height: -denomCellHeight,
                color: altRow,
            });
        }
        const denomData = (data.denominations || []).find(d => d.denomination === denom) || { denomination: denom, count: '', amount: '' };
        page.drawText(`${denom}`, { x: denomTableX + 10, y: currentY - 14, size: 10, font, color: black });
        page.drawText(`${denomData.count || ''}`, { x: denomTableX + denomCellWidths[0] + 10, y: currentY - 14, size: 10, font, color: black });
        page.drawText(`${denomData.amount || ''}`, { x: denomTableX + denomCellWidths[0] + denomCellWidths[1] + 10, y: currentY - 14, size: 10, font, color: black });
        page.drawLine({ start: { x: denomTableX, y: currentY }, end: { x: denomTableX + denomCellWidths.reduce((sum, width) => sum + width, 0), y: currentY }, thickness: tableBorderWidth, color: blue });
        currentY -= denomCellHeight;
    });
    page.drawLine({
        start: { x: denomTableX, y: denomTableY - denomRows * denomCellHeight },
        end: { x: currentX, y: denomTableY - denomRows * denomCellHeight },
        thickness: tableBorderWidth,
        color: blue,
    });

    // Section divider before signatures
    const signatureY = denomTableY - denomRows * denomCellHeight - 15;
    page.drawLine({
        start: { x: borderMargin + 10, y: signatureY },
        end: { x: pageWidth - borderMargin - 10, y: signatureY },
        thickness: 1.5,
        color: blue,
    });

    // Signatures
    page.drawText('Signature of the Official', { x: borderMargin + 20, y: signatureY - 40, size: 10, font: fontBold });
    page.drawLine({ start: { x: borderMargin + 20, y: signatureY - 25 }, end: { x: borderMargin + 180, y: signatureY - 25 }, thickness: 0.8, color: blue });

    page.drawText('Signature of Depositor', { x: pageWidth - borderMargin - 200, y: signatureY - 40, size: 10, font: fontBold });
    page.drawLine({ start: { x: pageWidth - borderMargin - 200, y: signatureY - 25 }, end: { x: pageWidth - borderMargin - 40, y: signatureY - 25 }, thickness: 0.8, color: blue });

    // Footer/contact info
    page.drawText('For queries: joyfulkingdomschool@gmail.com | www.joyfulkingdom.com', {
        x: borderMargin + 10,
        y: borderMargin + 15,
        size: 8,
        font,
        color: blue,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR);
    const filename = `${data.studentName?.replace(/\s+/g, '_') || 'receipt'}_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(PDF_DIR, filename), pdfBytes);

    // Save metadata
    const meta = loadMeta();
    meta.push({ studentName: data.studentName, filename, date: data.date });
    saveMeta(meta);

    res.json({ success: true, filename });
});

// --- PDF List/Search Endpoint ---
app.get('/invoices', authenticateToken, (req, res) => {
    const meta = loadMeta();
    const { studentName } = req.query;
    const filtered = studentName
        ? meta.filter(m => m.studentName?.toLowerCase().includes(studentName.toLowerCase()))
        : meta;
    res.json(filtered);
});

// --- PDF Download Endpoint ---
app.get('/download/:filename', (req, res) => {
    const file = path.join(PDF_DIR, req.params.filename);
    if (!fs.existsSync(file)) return res.status(404).send('Not found');
    res.download(file);
});

        // --- Serve React build for all other routes ---
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

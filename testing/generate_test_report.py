import html
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "test-results"
SUMMARY_PATH = RESULTS / "test-summary.json"
PDF_PATH = RESULTS / "DasMom_Complete_Test_Report.pdf"

NAVY = colors.HexColor("#18324B")
BLUE = colors.HexColor("#2F6690")
PALE_BLUE = colors.HexColor("#EAF2F8")
PALE_GRAY = colors.HexColor("#F3F5F7")
TEXT = colors.HexColor("#263238")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=26, leading=31, textColor=NAVY, alignment=TA_CENTER, spaceAfter=18,
))
styles.add(ParagraphStyle(
    name="Section", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=16, leading=20, textColor=NAVY, spaceBefore=12, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="Subsection", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=11, leading=14, textColor=BLUE, spaceBefore=8, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="BodySmall", parent=styles["BodyText"], fontSize=8.5, leading=12,
    textColor=TEXT, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="TableCell", parent=styles["BodyText"], fontSize=7.5, leading=10,
    textColor=TEXT,
))
styles.add(ParagraphStyle(
    name="TableHeader", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=7.5, leading=10, textColor=colors.white,
))
styles.add(ParagraphStyle(
    name="CoverMeta", parent=styles["BodyText"], fontSize=11, leading=17,
    alignment=TA_CENTER, textColor=TEXT,
))


def para(value, style="BodySmall"):
    return Paragraph(html.escape(str(value)).replace("\n", "<br/>"), styles[style])


def make_table(headers, rows, widths):
    data = [[para(value, "TableHeader") for value in headers]]
    for row in rows:
        data.append([para(value, "TableCell") for value in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CAD3DA")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def page_chrome(canvas, document):
    canvas.saveState()
    width, height = letter
    canvas.setStrokeColor(colors.HexColor("#D7E0E7"))
    canvas.line(document.leftMargin, 0.58 * inch, width - document.rightMargin, 0.58 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#60717E"))
    canvas.drawString(document.leftMargin, 0.4 * inch, "DasMom Software Testing Report")
    canvas.drawRightString(width - document.rightMargin, 0.4 * inch, f"Page {document.page}")
    canvas.restoreState()


def section(title):
    return Paragraph(html.escape(title), styles["Section"])


def bullet_list(items):
    return [para(f"- {item}") for item in items]


def main():
    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    RESULTS.mkdir(exist_ok=True)
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=letter,
        rightMargin=0.62 * inch,
        leftMargin=0.62 * inch,
        topMargin=0.62 * inch,
        bottomMargin=0.78 * inch,
        title="DasMom - Complete Software Testing Report",
        author="DasMom QA assessment",
    )
    story = [
        Spacer(1, 1.15 * inch),
        Paragraph("DasMom", styles["CoverTitle"]),
        Paragraph("Complete Software Testing Report", styles["CoverMeta"]),
        Spacer(1, 0.3 * inch),
        Paragraph(f"Execution date: {html.escape(summary['report']['generated_at'])}", styles["CoverMeta"]),
        Paragraph(f"Version: {html.escape(summary['report']['version'])}", styles["CoverMeta"]),
        Paragraph(f"Branch / commit: {html.escape(summary['report']['branch'])} / {html.escape(summary['report']['commit'])}", styles["CoverMeta"]),
        Paragraph(f"Environment: {html.escape(summary['report']['environment'])}", styles["CoverMeta"]),
        Spacer(1, 0.45 * inch),
        Paragraph(f"FINAL ASSESSMENT: {html.escape(summary['report']['final_assessment'])}", styles["CoverTitle"]),
        Spacer(1, 0.25 * inch),
        para("Evidence is limited to checks actually executed in this local worktree. No production database, patient records, or remote services were exercised."),
        PageBreak(),
        section("Contents"),
    ]
    for item in [
        "1. Executive summary",
        "2. Environment and tooling",
        "3. Feature and test coverage",
        "4. Detailed checks and defects",
        "5. Security and performance",
        "6. Unresolved issues and release assessment",
    ]:
        story.append(para(item))

    counts = summary["summary"]
    story.extend([
        section("1. Executive summary"),
        para(summary["report"]["executive_summary"]),
        make_table(
            ["Tests passed", "Failed", "Skipped", "Blocked"],
            [[counts["passed"], counts["failed"], counts["skipped"], counts["blocked"]]],
            [1.35 * inch] * 4,
        ),
        Spacer(1, 8),
        para(f"Other gates: build {summary['checks']['build']}; full lint {summary['checks']['lint']}; full dependency audit {summary['checks']['dependency_audit']}."),
        section("2. Environment and tooling"),
        make_table(
            ["Item", "Observed"],
            [[item["name"], item["value"]] for item in summary["tools"]],
            [1.8 * inch, 4.65 * inch],
        ),
        section("3. Feature and test coverage"),
        make_table(
            ["Feature area", "Method / evidence", "Result / outstanding scope"],
            [[item["feature"], item["method"], item["result"]] for item in summary["features"]],
            [1.55 * inch, 2.45 * inch, 2.45 * inch],
        ),
        PageBreak(),
        section("4. Detailed checks and defects"),
    ])
    for check in summary["detailed_checks"]:
        story.append(Paragraph(html.escape(check["title"]), styles["Subsection"]))
        story.append(para(check["result"]))

    story.extend([
        Paragraph("Defect register", styles["Subsection"]),
        make_table(
            ["ID / priority", "Finding", "Resolution / verification"],
            [[item["id"], item["finding"], item["resolution"]] for item in summary["defects"]],
            [1.15 * inch, 2.65 * inch, 2.65 * inch],
        ),
        section("5. Security and performance"),
        make_table(
            ["Area", "Finding / result"],
            [[item["area"], item["result"]] for item in summary["security_performance"]],
            [1.6 * inch, 4.85 * inch],
        ),
        section("6. Unresolved issues and release assessment"),
    ])
    story.extend(bullet_list(summary["limitations"]))
    story.append(Spacer(1, 8))
    story.append(para(f"Conclusion: {summary['report']['final_assessment']}. {summary['report']['conclusion']}"))
    story.append(Spacer(1, 8))
    story.append(para("Commands used for final verification: npm test -- --test-reporter=spec; npm run test:component; npm run build; npx eslint src; npm audit.", "BodySmall"))

    doc.build(story, onFirstPage=page_chrome, onLaterPages=page_chrome)
    print(PDF_PATH)


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
Spillburg Holdings Enterprise Portal - Pure Python OpenXML (.xlsx) Exporter
Generates 100% valid, repair-free Excel spreadsheets with Calibri size 8 styling.
Zero third-party pip dependencies required. Built with Python 3 Standard Library.
"""

import io
import zipfile
import xml.sax.saxutils as saxutils

def escape_xml(s):
    if s is None:
        return ""
    return saxutils.escape(str(s))

def generate_payroll_xlsx(enriched_period, company_info=None):
    """
    Generates a 100% compliant OpenXML (.xlsx) binary stream in Calibri size 8
    matching the exact corporate payroll table structure with zero repair errors.
    """
    comp = company_info or {}
    currency_mode = comp.get("currencyMode") or enriched_period.get("currencyMode") or "dual"
    base_curr = comp.get("foreignCurrency") or enriched_period.get("baseCurrency") or "GBP"
    month = enriched_period.get("month", "Period")
    rate = float(enriched_period.get("exchangeRate", 440.0) or 440.0)
    employees = enriched_period.get("employees", [])
    totals = enriched_period.get("totals", {})

    rate_disp = int(rate) if rate == int(rate) else rate

    sheet_rows = []
    current_row_idx = 1
    col_letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"]

    if currency_mode == "dual":
        # ==========================================
        # TABLE 1: FOREIGN BASE CURRENCY (e.g. GBP)
        # ==========================================
        title1 = f"SALARY SHEET (IN {base_curr} ) - {month.upper()}"
        sheet_rows.append((current_row_idx, [("A", 6, "inlineStr", title1)]))
        current_row_idx += 1

        t1_headers = [
            ("No", 7),
            ("Employee Name", 8),
            ("POSITION", 8),
            (f"{base_curr} Salary", 9),
            ("Working Days", 7),
            (f"Earned Base ({base_curr})", 9),
            ("EPF (12% )", 9),
            ("ETF(3% )", 9),
            (f"Total Employer Cost ({base_curr})", 9),
            ("BANK ACCOUNT NO", 7),
            ("TIN NO", 7),
            ("IDNO", 7),
            ("Date Joined", 7)
        ]
        row_cells = []
        for c_idx, (h_text, s_idx) in enumerate(t1_headers):
            row_cells.append((col_letters[c_idx], s_idx, "inlineStr", h_text))
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        for e in employees:
            bank_str = f"{e.get('bankAccountNo','')}({e.get('bankCode','')})" if e.get('bankCode') else str(e.get('bankAccountNo',''))
            row_cells = [
                ("A", 11, "num", e.get("no", "")),
                ("B", 10, "inlineStr", str(e.get("name", "")).upper()),
                ("C", 10, "inlineStr", e.get("position", "")),
                ("D", 13, "num", e.get("gbpSalary", 0)),
                ("E", 11, "inlineStr", e.get("workDays", "")),
                ("F", 13, "num", e.get("earnedGbp", 0)),
                ("G", 13, "num", e.get("epf12Gbp", 0)),
                ("H", 13, "num", e.get("etf3Gbp", 0)),
                ("I", 14, "num", e.get("totalGbp", 0)),
                ("J", 10, "inlineStr", bank_str),
                ("K", 11, "inlineStr", e.get("tinNo", "")),
                ("L", 11, "inlineStr", e.get("idNo", "")),
                ("M", 11, "inlineStr", e.get("dateJoined", ""))
            ]
            sheet_rows.append((current_row_idx, row_cells))
            current_row_idx += 1

        # Table 1 Totals
        row_cells = [
            ("A", 15, "inlineStr", "TOTAL"),
            ("B", 15, "inlineStr", ""),
            ("C", 15, "inlineStr", ""),
            ("D", 17, "num", totals.get("sumGbpSalary", 0)),
            ("E", 15, "inlineStr", ""),
            ("F", 17, "num", totals.get("sumEarnedGbp", 0)),
            ("G", 17, "num", totals.get("sumEpf12Gbp", 0)),
            ("H", 17, "num", totals.get("sumEtf3Gbp", 0)),
            ("I", 17, "num", totals.get("sumTotalGbp", 0)),
            ("J", 15, "inlineStr", ""),
            ("K", 15, "inlineStr", ""),
            ("L", 15, "inlineStr", ""),
            ("M", 15, "inlineStr", "")
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        # Sign-off row
        checked_str = f"Checked by: {enriched_period.get('checkedBy') or comp.get('checkedBy') or 'Hemanthi Basnayake'}, {enriched_period.get('checkedTitle') or comp.get('checkedTitle') or 'Accountant'}"
        auth_str = f"Authorized by: {enriched_period.get('authorizedSignatory') or comp.get('authorizedSignatory') or 'Shaameel Mohideen'}, {enriched_period.get('authorizedCompany') or comp.get('authorizedCompany') or comp.get('name') or 'Spillburg Holdings (Pvt) Ltd.'}"
        row_cells = [
            ("A", 18, "inlineStr", checked_str),
            ("F", 18, "inlineStr", auth_str)
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 2

        # ==========================================
        # TABLE 2: LKR REMITTANCE TABLE
        # ==========================================
        title2 = f"SALARY SHEET (IN LKR) - {month.upper()} @ {rate_disp}"
        sheet_rows.append((current_row_idx, [("A", 6, "inlineStr", title2)]))
        current_row_idx += 1

        t2_headers = [
            ("No", 7),
            ("Employee Name", 8),
            ("POSITION", 8),
            (f"{base_curr} Salary", 9),
            ("Working Days", 7),
            (f"Earned Base ({base_curr})", 9),
            ("LKR", 9),
            ("EPF 8%", 9),
            ("EPF12%", 9),
            ("ETF 3%", 9),
            ("APIT", 9),
            ("Other Deductions", 9),
            ("Net Remittance (LKR)", 9)
        ]
        row_cells = []
        for c_idx, (h_text, s_idx) in enumerate(t2_headers):
            row_cells.append((col_letters[c_idx], s_idx, "inlineStr", h_text))
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        for e in employees:
            row_cells = [
                ("A", 11, "num", e.get("no", "")),
                ("B", 10, "inlineStr", str(e.get("name", "")).upper()),
                ("C", 10, "inlineStr", e.get("position", "")),
                ("D", 13, "num", e.get("gbpSalary", 0)),
                ("E", 11, "inlineStr", e.get("workDays", "")),
                ("F", 13, "num", e.get("earnedGbp", 0)),
                ("G", 13, "num", e.get("lkrGross", 0)),
                ("H", 13, "num", e.get("epf8Lkr", 0)),
                ("I", 13, "num", e.get("epf12Lkr", 0)),
                ("J", 13, "num", e.get("etf3Lkr", 0)),
                ("K", 13, "num", e.get("apit", 0)),
                ("L", 13, "num", e.get("otherDeductions", 0)),
                ("M", 14, "num", e.get("netSalaryLkr", 0))
            ]
            sheet_rows.append((current_row_idx, row_cells))
            current_row_idx += 1

        row_cells = [
            ("A", 15, "inlineStr", "TOTAL"),
            ("B", 15, "inlineStr", ""),
            ("C", 15, "inlineStr", ""),
            ("D", 17, "num", totals.get("sumGbpSalary", 0)),
            ("E", 15, "inlineStr", ""),
            ("F", 17, "num", totals.get("sumEarnedGbp", 0)),
            ("G", 17, "num", totals.get("sumLkrGross", 0)),
            ("H", 17, "num", totals.get("sumEpf8Lkr", 0)),
            ("I", 17, "num", totals.get("sumEpf12Lkr", 0)),
            ("J", 17, "num", totals.get("sumEtf3Lkr", 0)),
            ("K", 17, "num", totals.get("sumApitLkr", 0)),
            ("L", 17, "num", totals.get("sumOtherDeductionsLkr", 0)),
            ("M", 17, "num", totals.get("sumNetSalaryLkr", 0))
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

    else:
        # ==========================================
        # SINGLE CURRENCY (LKR ONLY)
        # ==========================================
        title_single = f"SALARY SHEET (IN LKR) - {month.upper()}"
        sheet_rows.append((current_row_idx, [("A", 6, "inlineStr", title_single)]))
        current_row_idx += 1

        single_headers = [
            ("No", 7),
            ("Employee Name", 8),
            ("POSITION", 8),
            ("Basic Salary (LKR)", 9),
            ("Working Days", 7),
            ("Earned Base (LKR)", 9),
            ("EPF 8%", 9),
            ("EPF 12%", 9),
            ("ETF 3%", 9),
            ("APIT", 9),
            ("Other Deductions", 9),
            ("Net Remittance (LKR)", 9),
            ("BANK ACCOUNT NO", 7),
            ("TIN NO", 7),
            ("IDNO", 7),
            ("Date Joined", 7)
        ]
        row_cells = []
        for c_idx, (h_text, s_idx) in enumerate(single_headers):
            row_cells.append((col_letters[c_idx], s_idx, "inlineStr", h_text))
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        for e in employees:
            bank_str = f"{e.get('bankAccountNo','')}({e.get('bankCode','')})" if e.get('bankCode') else str(e.get('bankAccountNo',''))
            base_sal = e.get("lkrSalary") or e.get("baseSalaryLkr") or e.get("lkrGross", 0)
            row_cells = [
                ("A", 11, "num", e.get("no", "")),
                ("B", 10, "inlineStr", str(e.get("name", "")).upper()),
                ("C", 10, "inlineStr", e.get("position", "")),
                ("D", 13, "num", base_sal),
                ("E", 11, "inlineStr", e.get("workDays", "")),
                ("F", 13, "num", e.get("lkrGross", 0)),
                ("G", 13, "num", e.get("epf8Lkr", 0)),
                ("H", 13, "num", e.get("epf12Lkr", 0)),
                ("I", 13, "num", e.get("etf3Lkr", 0)),
                ("J", 13, "num", e.get("apit", 0)),
                ("K", 13, "num", e.get("otherDeductions", 0)),
                ("L", 14, "num", e.get("netSalaryLkr", 0)),
                ("M", 10, "inlineStr", bank_str),
                ("N", 11, "inlineStr", e.get("tinNo", "")),
                ("O", 11, "inlineStr", e.get("idNo", "")),
                ("P", 11, "inlineStr", e.get("dateJoined", ""))
            ]
            sheet_rows.append((current_row_idx, row_cells))
            current_row_idx += 1

        # Single currency totals row
        row_cells = [
            ("A", 15, "inlineStr", "TOTAL"),
            ("B", 15, "inlineStr", ""),
            ("C", 15, "inlineStr", ""),
            ("D", 17, "num", totals.get("sumLkrGross", 0)),
            ("E", 15, "inlineStr", ""),
            ("F", 17, "num", totals.get("sumLkrGross", 0)),
            ("G", 17, "num", totals.get("sumEpf8Lkr", 0)),
            ("H", 17, "num", totals.get("sumEpf12Lkr", 0)),
            ("I", 17, "num", totals.get("sumEtf3Lkr", 0)),
            ("J", 17, "num", totals.get("sumApitLkr", 0)),
            ("K", 17, "num", totals.get("sumOtherDeductionsLkr", 0)),
            ("L", 17, "num", totals.get("sumNetSalaryLkr", 0)),
            ("M", 15, "inlineStr", ""),
            ("N", 15, "inlineStr", ""),
            ("O", 15, "inlineStr", ""),
            ("P", 15, "inlineStr", "")
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

        # Sign-off row
        checked_str = f"Checked by: {enriched_period.get('checkedBy') or comp.get('checkedBy') or 'Hemanthi Basnayake'}, {enriched_period.get('checkedTitle') or comp.get('checkedTitle') or 'Accountant'}"
        auth_str = f"Authorized by: {enriched_period.get('authorizedSignatory') or comp.get('authorizedSignatory') or 'Shaameel Mohideen'}, {enriched_period.get('authorizedCompany') or comp.get('authorizedCompany') or comp.get('name') or 'Spillburg Holdings (Pvt) Ltd.'}"
        row_cells = [
            ("A", 18, "inlineStr", checked_str),
            ("F", 18, "inlineStr", auth_str)
        ]
        sheet_rows.append((current_row_idx, row_cells))
        current_row_idx += 1

    # Build XML string for sheet1.xml
    sheet_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '  <sheetViews>',
        '    <sheetView tabSelected="1" workbookViewId="0">',
        '      <selection activeCell="A1" sqref="A1"/>',
        '    </sheetView>',
        '  </sheetViews>',
        '  <sheetFormatPr defaultRowHeight="16"/>',
        '  <cols>',
        '    <col min="1" max="1" width="5" customWidth="1"/>',
        '    <col min="2" max="2" width="32" customWidth="1"/>',
        '    <col min="3" max="3" width="25" customWidth="1"/>',
        '    <col min="4" max="4" width="15" customWidth="1"/>',
        '    <col min="5" max="5" width="13" customWidth="1"/>',
        '    <col min="6" max="6" width="17" customWidth="1"/>',
        '    <col min="7" max="7" width="15" customWidth="1"/>',
        '    <col min="8" max="8" width="13" customWidth="1"/>',
        '    <col min="9" max="9" width="15" customWidth="1"/>',
        '    <col min="10" max="10" width="17" customWidth="1"/>',
        '    <col min="11" max="11" width="14" customWidth="1"/>',
        '    <col min="12" max="12" width="16" customWidth="1"/>',
        '    <col min="13" max="13" width="18" customWidth="1"/>',
        '    <col min="14" max="16" width="15" customWidth="1"/>',
        '  </cols>',
        '  <sheetData>'
    ]

    for r_idx, cells in sheet_rows:
        sheet_xml_lines.append(f'    <row r="{r_idx}">')
        for c_col, s_idx, c_type, val in cells:
            cell_ref = f"{c_col}{r_idx}"
            if c_type == "num":
                try:
                    num_val = float(val) if val != "" else 0
                    if num_val == int(num_val) and s_idx in (11, 12, 16):
                        sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}"><v>{int(num_val)}</v></c>')
                    else:
                        sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}"><v>{num_val:.2f}</v></c>')
                except (ValueError, TypeError):
                    escaped_str = escape_xml(val)
                    sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}" t="inlineStr"><is><t>{escaped_str}</t></is></c>')
            else:
                escaped_str = escape_xml(val)
                sheet_xml_lines.append(f'      <c r="{cell_ref}" s="{s_idx}" t="inlineStr"><is><t>{escaped_str}</t></is></c>')
        sheet_xml_lines.append('    </row>')

    sheet_xml_lines.append('  </sheetData>')
    sheet_xml_lines.append('</worksheet>')
    sheet_xml = '\n'.join(sheet_xml_lines)

    # Stylesheet with Calibri size 8 across ALL elements
    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
  </numFmts>
  <fonts count="4">
    <!-- Font 0: Normal Calibri 8 -->
    <font><sz val="8"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 1: Bold Calibri 8 -->
    <font><b/><sz val="8"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 2: Bold Calibri 8 (Corporate Blue) -->
    <font><b/><sz val="8"/><color rgb="FF1E3A8A"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 3: Italic Calibri 8 -->
    <font><i/><sz val="8"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <!-- Required fills 0 and 1 -->
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <!-- Fill 2: Table Header Soft Gray #F2F2F2 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill>
    <!-- Fill 3: Section Title Soft Blue #D9E1F2 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>
    <!-- Fill 4: Light Accent Green #E2EFDA -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/></patternFill></fill>
  </fills>
  <borders count="4">
    <!-- Border 0: None -->
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <!-- Border 1: Thin Gray border all around -->
    <border>
      <left style="thin"><color rgb="FFD4D4D8"/></left>
      <right style="thin"><color rgb="FFD4D4D8"/></right>
      <top style="thin"><color rgb="FFD4D4D8"/></top>
      <bottom style="thin"><color rgb="FFD4D4D8"/></bottom>
      <diagonal/>
    </border>
    <!-- Border 2: Accounting Totals (Top Thin, Bottom Double) -->
    <border>
      <left/><right/>
      <top style="thin"><color rgb="FF000000"/></top>
      <bottom style="double"><color rgb="FF000000"/></bottom>
      <diagonal/>
    </border>
    <!-- Border 3: Header border -->
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="thin"><color rgb="FF94A3B8"/></top>
      <bottom style="medium"><color rgb="FF475569"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="19">
    <!-- 0: Normal text left -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 1: Normal text center -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 2: Normal text right -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 3: Bold text left -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 4: Bold text center -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 5: Bold text right -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 6: Section Header Title (bold 8pt, bg #D9E1F2, left) -->
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 7: Table Header center (bold 8pt, bg #F2F2F2, border 3) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 8: Table Header left (bold 8pt, bg #F2F2F2, border 3) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <!-- 9: Table Header right (bold 8pt, bg #F2F2F2, border 3) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>
    <!-- 10: Data cell text left (border 1) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <!-- 11: Data cell text center (border 1) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 12: Data cell integer right (border 1, numFmt #,##0) -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 13: Data cell float right (border 1, numFmt #,##0.00) -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 14: Data cell bold float right (border 1, numFmt #,##0.00, font 2 blue) -->
    <xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 15: Totals row label (bold, border 2) -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 16: Totals row integer (bold, border 2, numFmt #,##0) -->
    <xf numFmtId="165" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 17: Totals row float (bold, border 2, numFmt #,##0.00) -->
    <xf numFmtId="164" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 18: Signoff row (calibri 8) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>"""

    # Assemble zip archive
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>""")

        z.writestr('_rels/.rels', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>""")

        z.writestr('docProps/app.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Spillburg Enterprise Portal</Application>
</Properties>""")

        z.writestr('docProps/core.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:creator>Spillburg Holdings</dc:creator>
  <cp:lastModifiedBy>Spillburg Holdings</cp:lastModifiedBy>
</cp:coreProperties>""")

        z.writestr('xl/_rels/workbook.xml.rels', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>""")

        z.writestr('xl/workbook.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Salary Sheet" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>""")

        z.writestr('xl/styles.xml', styles_xml)
        z.writestr('xl/worksheets/sheet1.xml', sheet_xml)

    return bio.getvalue()


def generate_payslips_xlsx(enriched_period, company_info=None, single_emp_id=None):
    comp = company_info or {}
    comp_name = comp.get('name') or 'APADMI SL (PRIVATE) LIMITED'
    year_period = enriched_period.get('yearPeriod') or comp.get('payrollYearPeriod') or '2026-2027'
    month_name = enriched_period.get('monthCode') or enriched_period.get('month', 'Month')
    currency_mode = comp.get('currencyMode') or enriched_period.get('currencyMode') or 'dual'
    foreign_curr = comp.get('foreignCurrency') or enriched_period.get('baseCurrency') or 'GBP'
    rate = float(enriched_period.get('exchangeRate', 440.0) or 440.0)

    addr1 = comp.get('addressLine1') or comp.get('address') or 'Office 14, Basement Level'
    addr2 = comp.get('addressLine2') or 'Cinnamon Lakeside Hotel - Colombo 02'

    all_emps = enriched_period.get('employees', [])
    if single_emp_id:
        target_emps = [e for e in all_emps if str(e.get('id')) == str(single_emp_id)]
        if not target_emps:
            target_emps = all_emps[:1]
    else:
        target_emps = all_emps

    # Organize employees into pairs for 2-up vertical vouchers side-by-side
    pairs = []
    if single_emp_id:
        pairs = [(target_emps[0], None)]
    else:
        for i in range(0, len(target_emps), 2):
            e1 = target_emps[i]
            e2 = target_emps[i+1] if i+1 < len(target_emps) else None
            pairs.append((e1, e2))

    sheet_rows = []
    merge_cells = []
    current_row = 2  # Start on row 2 for top breathing margin

    for pair_idx, (e1, e2) in enumerate(pairs):
        start_row = current_row

        def build_voucher_rows(emp, col_lbl, col_val):
            v_rows = []
            if not emp:
                return v_rows

            epf_no = str(emp.get('epfNo') or f"{emp.get('no', 1):02d}")
            emp_name = str(emp.get('name', '')).upper()

            # Dynamic basic pay label
            if currency_mode == 'single':
                basic_label = 'Basic Pay'
            else:
                earned_f = float(emp.get('earnedGbp') or emp.get('gbpSalary') or 0.0)
                basic_label = f"Basic Pay ({foreign_curr} {earned_f:,.2f} @{rate:,.2f})"

            # 1. Company Name (merged across lbl & val)
            v_rows.append(('title', 24, [
                (col_lbl, 15, 'inlineStr', comp_name.upper()),
                (col_val, 15, 'empty', '')
            ], True))

            # 2. Subtitle: Monthly Payroll
            v_rows.append(('sub', 18, [
                (col_lbl, 16, 'inlineStr', f"Monthly Payroll {year_period}"),
                (col_val, 16, 'empty', '')
            ], True))

            # 3. EPF NO
            v_rows.append(('epf', 20, [
                (col_lbl, 17, 'inlineStr', f"EPF NO :{epf_no}"),
                (col_val, 17, 'empty', '')
            ], True))

            # 4. Month
            v_rows.append(('row', 21, [
                (col_lbl, 4, 'inlineStr', 'Month'),
                (col_val, 9, 'inlineStr', month_name)
            ], False))

            # 5. Name
            v_rows.append(('row', 21, [
                (col_lbl, 4, 'inlineStr', 'Name'),
                (col_val, 9, 'inlineStr', emp_name)
            ], False))

            # 6. Currency Header
            v_rows.append(('row', 20, [
                (col_lbl, 3, 'inlineStr', ''),
                (col_val, 10, 'inlineStr', 'LKR')
            ], False))

            # 7. Basic Pay
            v_rows.append(('row', 21, [
                (col_lbl, 1, 'inlineStr', basic_label),
                (col_val, 5, 'num', float(emp.get('lkrGross', 0.0) or 0.0))
            ], False))

            # 8. Special Allowance
            sa = float(emp.get('specialAllowance', 0.0) or 0.0)
            v_rows.append(('row', 20, [
                (col_lbl, 1, 'inlineStr', 'Special Allowance'),
                (col_val, 5 if sa > 0 else 8, 'num' if sa > 0 else 'inlineStr', sa if sa > 0 else '-')
            ], False))

            # 9. Total (Gross)
            v_rows.append(('row', 22, [
                (col_lbl, 4, 'inlineStr', 'Total (Gross)'),
                (col_val, 7, 'num', float(emp.get('totalGrossLkr', 0.0) or 0.0))
            ], False))

            # 10. (-) No Pay/Late
            np = float(emp.get('noPayLate', 0.0) or 0.0)
            v_rows.append(('row', 20, [
                (col_lbl, 1, 'inlineStr', '(-) No Pay/Late'),
                (col_val, 5 if np > 0 else 8, 'num' if np > 0 else 'inlineStr', np if np > 0 else '-')
            ], False))

            # 11. Net total
            v_rows.append(('row', 21, [
                (col_lbl, 2, 'inlineStr', 'Net total'),
                (col_val, 6, 'num', float(emp.get('netTotalGross', 0.0) or 0.0))
            ], False))

            # 12. Gross Pay
            v_rows.append(('row', 21, [
                (col_lbl, 2, 'inlineStr', 'Gross Pay'),
                (col_val, 6, 'num', float(emp.get('netTotalGross', 0.0) or 0.0))
            ], False))

            # 13. (-) EPF 8%
            v_rows.append(('row', 20, [
                (col_lbl, 1, 'inlineStr', '(-) EPF 8%'),
                (col_val, 5, 'num', float(emp.get('epf8Lkr', 0.0) or 0.0))
            ], False))

            # 14. Deductions: Other / Advance / Loan
            other_ded = float(emp.get('otherDeductions', 0.0) or 0.0)
            adv = float(emp.get('advance', 0.0) or 0.0)
            loan = float(emp.get('loan', 0.0) or 0.0)
            if other_ded > 0:
                v_rows.append(('row', 20, [
                    (col_lbl, 1, 'inlineStr', '(-) Other Deductions'),
                    (col_val, 5, 'num', other_ded)
                ], False))
            elif adv > 0:
                v_rows.append(('row', 20, [
                    (col_lbl, 1, 'inlineStr', '(-) Advance'),
                    (col_val, 5, 'num', adv)
                ], False))
            elif loan > 0:
                v_rows.append(('row', 20, [
                    (col_lbl, 1, 'inlineStr', '(-) Loan'),
                    (col_val, 5, 'num', loan)
                ], False))
            else:
                v_rows.append(('row', 20, [
                    (col_lbl, 1, 'inlineStr', '(-) Other Deductions'),
                    (col_val, 8, 'inlineStr', '-')
                ], False))

            # 15. (-) APIT
            apit_val = float(emp.get('apit', 0.0) or 0.0)
            v_rows.append(('row', 20, [
                (col_lbl, 1, 'inlineStr', '(-) APIT'),
                (col_val, 5 if apit_val > 0 else 8, 'num' if apit_val > 0 else 'inlineStr', apit_val if apit_val > 0 else '-')
            ], False))

            # 16. Total Deduction
            v_rows.append(('row', 22, [
                (col_lbl, 11, 'inlineStr', 'Total Deduction'),
                (col_val, 12, 'num', float(emp.get('totalDeductions', 0.0) or 0.0))
            ], False))

            # 17. Balance Pay
            v_rows.append(('row', 25, [
                (col_lbl, 13, 'inlineStr', 'Balance Pay'),
                (col_val, 14, 'num', float(emp.get('netSalaryLkr', 0.0) or 0.0))
            ], False))

            # 18. EPF 12%
            v_rows.append(('row', 20, [
                (col_lbl, 1, 'inlineStr', 'EPF 12%'),
                (col_val, 5, 'num', float(emp.get('epf12Lkr', 0.0) or 0.0))
            ], False))

            # 19. ETF 3%
            v_rows.append(('row', 20, [
                (col_lbl, 1, 'inlineStr', 'ETF 3%'),
                (col_val, 5, 'num', float(emp.get('etf3Lkr', 0.0) or 0.0))
            ], False))

            # 20. Signature Line
            v_rows.append(('sig', 24, [
                (col_lbl, 18, 'inlineStr', 'Signature: ....................................................'),
                (col_val, 18, 'empty', '')
            ], True))

            # 21. Company Footer Name
            v_rows.append(('sig_comp', 18, [
                (col_lbl, 19, 'inlineStr', comp_name),
                (col_val, 19, 'empty', '')
            ], True))

            # 22. Company Address Line 1
            v_rows.append(('sig_addr1', 16, [
                (col_lbl, 20, 'inlineStr', addr1),
                (col_val, 20, 'empty', '')
            ], True))

            # 23. Company Address Line 2
            v_rows.append(('sig_addr2', 16, [
                (col_lbl, 20, 'inlineStr', addr2),
                (col_val, 20, 'empty', '')
            ], True))

            return v_rows

        v1 = build_voucher_rows(e1, 'B', 'C')
        v2 = build_voucher_rows(e2, 'E', 'F') if e2 else []

        num_card_rows = max(len(v1), len(v2))
        for r_offset in range(num_card_rows):
            r_idx = start_row + r_offset
            combined_cells = []
            row_ht = 20

            if r_offset < len(v1):
                _, ht1, cells1, is_merge1 = v1[r_offset]
                row_ht = max(row_ht, ht1)
                combined_cells.extend(cells1)
                if is_merge1:
                    merge_cells.append(f"B{r_idx}:C{r_idx}")

            if r_offset < len(v2):
                _, ht2, cells2, is_merge2 = v2[r_offset]
                row_ht = max(row_ht, ht2)
                combined_cells.extend(cells2)
                if is_merge2:
                    merge_cells.append(f"E{r_idx}:F{r_idx}")

            sheet_rows.append((r_idx, row_ht, combined_cells))

        current_row = start_row + num_card_rows + 2  # 2 spacer rows between vertical vouchers

    rows_xml = []
    for r_idx, ht, cells in sheet_rows:
        c_xmls = []
        for col_let, s_idx, c_type, val in cells:
            cell_ref = f"{col_let}{r_idx}"
            if c_type == 'empty':
                c_xmls.append(f'<c r="{cell_ref}" s="{s_idx}"/>')
            elif c_type == 'num':
                c_xmls.append(f'<c r="{cell_ref}" s="{s_idx}"><v>{val}</v></c>')
            elif c_type == 'inlineStr':
                esc_val = escape_xml(val)
                c_xmls.append(f'<c r="{cell_ref}" s="{s_idx}" t="inlineStr"><is><t>{esc_val}</t></is></c>')
        rows_xml.append(f'<row r="{r_idx}" ht="{ht}" customHeight="1">' + "".join(c_xmls) + '</row>')

    merge_xml = ""
    if merge_cells:
        merge_xml = f'<mergeCells count="{len(merge_cells)}">' + "".join(f'<mergeCell ref="{m}"/>' for m in merge_cells) + '</mergeCells>'

    cols_xml = """<cols>
  <col min="1" max="1" width="3" customWidth="1"/>
  <col min="2" max="2" width="32" customWidth="1"/>
  <col min="3" max="3" width="18" customWidth="1"/>
  <col min="4" max="4" width="5" customWidth="1"/>
  <col min="5" max="5" width="32" customWidth="1"/>
  <col min="6" max="6" width="18" customWidth="1"/>
  <col min="7" max="7" width="3" customWidth="1"/>
</cols>"""

    sheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0" showGridLines="1"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  {cols_xml}
  <sheetData>
    {''.join(rows_xml)}
  </sheetData>
  {merge_xml}
  <pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
  <pageSetup orientation="landscape" paperSize="9"/>
</worksheet>"""

    styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
  </numFmts>
  <fonts count="7">
    <!-- Font 0: Regular Calibri 8.5 -->
    <font><sz val="8.5"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 1: Bold Calibri 8.5 -->
    <font><b/><sz val="8.5"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 2: Bold Calibri 10 (Company Title) -->
    <font><b/><sz val="10"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 3: Small Muted Calibri 8 -->
    <font><sz val="8"/><color rgb="FF475569"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 4: Bold Calibri 10 Emerald Green (#065F46) -->
    <font><b/><sz val="10"/><color rgb="FF065F46"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 5: Bold Calibri 8.5 Red (#DC2626) -->
    <font><b/><sz val="8.5"/><color rgb="FFDC2626"/><name val="Calibri"/><family val="2"/></font>
    <!-- Font 6: Italic Calibri 8 -->
    <font><i/><sz val="8"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="7">
    <!-- 0 & 1 required -->
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <!-- 2: Light Gray #F8FAFC -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <!-- 3: Soft Slate #F1F5F9 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
    <!-- 4: Emerald Light Green #ECFDF5 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/></patternFill></fill>
    <!-- 5: Soft Red #FEF2F2 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF2F2"/></patternFill></fill>
    <!-- 6: Pure White #FFFFFF -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
  </fills>
  <borders count="4">
    <!-- Border 0: None -->
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <!-- Border 1: Thin Gray border all around #CBD5E1 -->
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <!-- Border 2: Header bottom divider (Medium #1E293B) -->
    <border>
      <left/><right/><top/>
      <bottom style="medium"><color rgb="FF1E293B"/></bottom>
      <diagonal/>
    </border>
    <!-- Border 3: Signature top divider (Medium #1E293B) -->
    <border>
      <left/><right/>
      <top style="medium"><color rgb="FF1E293B"/></top>
      <bottom/>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="21">
    <!-- 0: Default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Regular text left, thin border -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 2: Bold text left, thin border -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 3: Regular text left, fill #F8FAFC, thin border -->
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 4: Bold text left, fill #F8FAFC, thin border -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 5: Amount regular right, #,##0.00, thin border -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 6: Amount bold right, #,##0.00, thin border -->
    <xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 7: Amount bold right, fill #F8FAFC, #,##0.00, thin border -->
    <xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 8: Regular text right, thin border -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 9: Bold text right, thin border -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 10: Currency tag "LKR" bold right, fill #F1F5F9, thin border -->
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 11: Deduction label bold red, fill #FEF2F2, thin border -->
    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 12: Deduction amount bold red, fill #FEF2F2, #,##0.00, thin border -->
    <xf numFmtId="164" fontId="5" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 13: Balance Pay label bold 10pt green, fill #ECFDF5, thin border -->
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 14: Balance Pay amount bold 10pt green, fill #ECFDF5, #,##0.00, thin border -->
    <xf numFmtId="164" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 15: Header company name bold 10pt, no border -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 16: Header subtitle 8pt gray, no border -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 17: Header EPF No bold 8.5pt, bottom border -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 18: Signature top line, border top medium -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 19: Signature company name bold 8.5pt -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 20: Signature address 8pt gray -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>"""

    # Assemble into full OpenXML package (.xlsx)
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>""")

        z.writestr('_rels/.rels', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>""")

        z.writestr('docProps/app.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Spillburg Enterprise Portal</Application>
</Properties>""")

        z.writestr('docProps/core.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:creator>Spillburg Holdings</dc:creator>
  <cp:lastModifiedBy>Spillburg Holdings</cp:lastModifiedBy>
</cp:coreProperties>""")

        z.writestr('xl/_rels/workbook.xml.rels', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>""")

        z.writestr('xl/workbook.xml', """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Payslips" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>""")

        z.writestr('xl/styles.xml', styles_xml)
        z.writestr('xl/worksheets/sheet1.xml', sheet_xml)

    return bio.getvalue()

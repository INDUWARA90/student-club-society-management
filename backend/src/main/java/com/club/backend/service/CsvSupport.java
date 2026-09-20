package com.club.backend.service;

/** CSV helpers shared by the exports. */
final class CsvSupport {

    private CsvSupport() {
    }

    /** Quotes values containing separators and neutralises spreadsheet formulas (=, +, -, @) in user-supplied text. */
    static String escape(String value) {
        if (value == null) {
            return "";
        }
        String safe = value;
        if (!safe.isEmpty() && "=+-@\t\r".indexOf(safe.charAt(0)) >= 0) {
            safe = "'" + safe;
        }
        return safe.contains(",") || safe.contains("\"") || safe.contains("\n")
                ? "\"" + safe.replace("\"", "\"\"") + "\"" : safe;
    }
}

package com.club.backend.entity;

public enum ReportStatus {
    /** Waiting for the Club Admin. */
    OPEN,
    /** The Club Admin reviewed it and left the comment in place. */
    DISMISSED,
    /** The Club Admin removed the comment. */
    ACTION_TAKEN
}

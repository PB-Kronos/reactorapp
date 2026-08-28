# Plant telephone concept — preserved for later

Manual extensions now support pickup-style **private calls**: the addressed
station receives an incoming-call popup, must accept it, and only the two
participating stations can view the live transcript. Hanging up removes the
conversation from both stations; the supervisor retains a separate audit log
of completed or declined calls.

The separate shared manual-extension layer is **PMS (Plant Messaging System)**:
PMS messages are delivered and kept without requiring pickup. Automated
numbers remain command services. Reserved numbers `*000`, `0000`, `0002`, and
`3333` stay excluded.

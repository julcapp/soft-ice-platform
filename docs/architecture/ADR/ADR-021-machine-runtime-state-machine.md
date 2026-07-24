# ADR-021: Machine Runtime State Machine

Status: Accepted  
Date: 2026-07-23

Machine Runtime becomes the sole authority for current operational execution state and allowed session transitions. It uses an explicit deny-by-default transition table and conflict policy. It does not own order, payment, stock, operator records, vendor transport, or read projections. V1 persistence is explicitly in-memory and non-durable.

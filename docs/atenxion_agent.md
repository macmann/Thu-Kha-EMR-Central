# Atenxion Agent API Examples

Use these cURL examples with a valid JWT in the `Authorization` header.

## Patient Summary
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/insights/patient-summary?patient_id={PATIENT_ID}&last_n=3"
```

## Cohort Query
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/insights/cohort?test_name=HbA1c&op=gt&value=8&months=6"
```

## Reporting Summary
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/reports/summary"
```

## Observation Lookup
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/observations/patients/{PATIENT_ID}/observations?author=me&limit=5"
```
Replace `{PATIENT_ID}` with the target patient UUID.

def get_prompt_xrays(detail_level):
    return f"""
Analyze this chest X-ray image.

Focus ONLY on lung fields.

Do NOT analyze:
- heart (cardiac silhouette)
- bones
- diaphragm

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 sentences
- Abnormality: 3 diseases
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 6 sentences
- Abnormality: 3 diseases
- Recommendation: 3 sentences per section

IF detail_level == "long":
- Findings: 10 sentences
- Abnormality: 3 diseases
- Recommendation: 5 sentences per section
- Add more explanation and reasoning

------------------------
TASK
------------------------
1. Identify visible abnormalities in lung regions
2. Describe findings in professional radiology style
3. Estimate risk level
4. Suggest most likely disease (NOT definitive diagnosis)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in detailed radiology narrative style
- Must follow the selected detail level
- Must read like a professional radiology report
- Include:
- location (left/right, upper/middle/lower zone)
- pattern (linear, patchy, diffuse)
- severity (mild/moderate/severe)
- Explain findings clearly (not bullet-like)
- Use natural medical language flow

Normal case:
- Clearly state lungs appear normal
- Avoid uncertain or speculative language

- Use semi-technical language (mix of medical + easy explanation)
- Avoid overly complex terminology
- Make it understandable for non-medical users

ABNORMALITY RULES:
- Must follow the selected detail level (jumlah penyakit)
- Must list 1–3 most likely diseases
- Use numbered format:

Example:
1. Pneumonia (infeksi paru-paru)
→ Penjelasan sederhana

2. Tuberculosis (TBC)
→ Penjelasan sederhana

- Each disease must include:
- medical name
- simple explanation in layman terms (Indonesian-friendly)

- Avoid technical terms without explanation
- If using medical terms (e.g. atelectasis), MUST explain meaning in simple language

- If normal:
"Tidak ditemukan kelainan yang signifikan pada paru-paru"

------------------------
BOUNDING BOX RULES
------------------------
- Detect ALL suspicious regions
- Maximum 5 boxes
- Must be tight and minimal
- Avoid healthy areas
- Coordinates normalized (0–1)
- If normal: return empty []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- affected area
- number of regions
- opacity intensity (low/medium/high)
- Provide simple explainable reasoning

------------------------
RECOMMENDATION RULES
------------------------
- Write in professional, doctor-oriented clinical language
- Use concise, structured, and medically appropriate terminology
- The output is intended for healthcare professionals, NOT patients

Structure:
- Use 2 parts:
1. Approach (clinical assessment & next steps)
2. Treatment (management plan)

Approach:
- Include clinical reasoning
- Suggest:
- differential diagnosis
- need for clinical correlation
- further investigations (lab, imaging, follow-up)

Treatment:
- Focus on medical management
- Can include:
- pharmacological therapy (e.g. antibiotik, antiinflamasi)
- monitoring plan
- follow-up imaging
- referral if needed

Style:
- Use formal and clinical tone
- Do NOT simplify for layman
- Be direct, precise, and professional


Tone:
- Objective, clinical, and evidence-oriented
- Avoid conversational or reassuring language

Risk-based behavior:

LOW RISK:
- Reassure the user
- Suggest monitoring only
- No urgent tone

MEDIUM RISK:
- Suggest follow-up if symptoms persist
- Explain why monitoring is needed

HIGH RISK:
- Suggest immediate medical attention
- Explain possible seriousness clearly

Tone:
- Calm, informative, and helpful
- Not too technical, not too casual

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "area": "...",
    "region_count": "...",
    "intensity": "...",
    "calculation": "..."
}},
"bboxes": [
    {{"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}}
],
"recommendation": {{
    "approach": "...",
    "treatment": "..."
}}
}}
"""


def get_prompt_fundus(detail_level):
    return f"""
Analyze this retinal fundus image.

Focus ONLY on retinal structures.

Do NOT analyze:
- non-retinal artifacts
- image borders or noise

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 sentences
- Abnormality: 3 diseases
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 6 sentences
- Abnormality: 3 diseases
- Recommendation: 3 sentences per section

IF detail_level == "long":
- Findings: 10 sentences
- Abnormality: 3 diseases
- Recommendation: 5 sentences per section
- Add more explanation and reasoning

------------------------
TASK
------------------------
1. Identify visible retinal abnormalities
2. Describe findings in detailed ophthalmology narrative
3. Estimate risk level
4. Suggest most likely disease(s) (NOT definitive diagnosis)
5. Provide clear clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in detailed ophthalmology narrative style
- Must follow the selected detail level
- Must read like a professional eye examination report
- Use flowing sentences (NOT bullet points)

Include:
- location (macula, optic disc, vascular arcades, peripheral retina)
- lesion type (microaneurysm, hemorrhage, exudate, cotton wool spot, neovascularization)
- distribution (localized, scattered, diffuse)
- severity (mild, moderate, severe)

Style:
- Use semi-technical language (medical + simple explanation)
- Avoid overly complex jargon
- Make it understandable for non-medical users

Normal case:
- Clearly state retina appears normal
- Mention absence of lesions
- Avoid uncertainty language

------------------------
ABNORMALITY RULES
------------------------
- MUST follow selected detail level (jumlah penyakit)
- MUST list 1–3 most likely diseases
- Use numbered format:

Example:
1. Diabetic Retinopathy (kerusakan retina akibat diabetes)
→ Jelaskan dengan bahasa sederhana

2. Hypertensive Retinopathy (gangguan retina akibat tekanan darah tinggi)
→ Jelaskan dengan bahasa sederhana

Requirements:
- Each disease MUST include:
- medical name
- simple explanation (bahasa Indonesia)
- Avoid unexplained medical terms

If normal:
"Tidak ditemukan kelainan signifikan pada retina"

------------------------
BOUNDING BOX RULES
------------------------
- Detect ALL suspicious lesions
- Maximum 5 boxes
- Tight and minimal (jangan terlalu besar)
- Focus only on abnormal areas
- Coordinates normalized (0–1)
- If normal: return []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- number of lesions
- distribution (localized vs diffuse)
- severity of lesions

- Provide simple reasoning:
explain why risk is low / medium / high

------------------------
RECOMMENDATION RULES
------------------------
- Write in professional, doctor-oriented clinical language
- Use concise, structured, and medically appropriate terminology
- The output is intended for healthcare professionals, NOT patients

Structure:
- Use 2 parts:
1. Approach (clinical assessment & next steps)
2. Treatment (management plan)

Approach:
- Include clinical reasoning
- Suggest:
- differential diagnosis
- need for clinical correlation
- further investigations (lab, imaging, follow-up)

Treatment:
- Focus on medical management
- Can include:
- pharmacological therapy (e.g. antibiotik, antiinflamasi)
- monitoring plan
- follow-up imaging
- referral if needed

Style:
- Use formal and clinical tone
- Do NOT simplify for layman
- Be direct, precise, and professional


Tone:
- Objective, clinical, and evidence-oriented
- Avoid conversational or reassuring language

Risk-based tone:

LOW RISK:
- Reassure patient
- Suggest monitoring

MEDIUM RISK:
- Suggest follow-up
- Explain why monitoring needed

HIGH RISK:
- Suggest urgent ophthalmology evaluation
- Explain possible seriousness

Tone:
- Calm, informative, not robotic

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "lesion_count": "...",
    "distribution": "...",
    "severity": "...",
    "calculation": "..."
}},
"bboxes": [
    {{"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}}
],
"recommendation": {{
    "approach": "...",
    "treatment": "..."
}}
}}
"""

def get_prompt_ct(detail_level):
    return f"""
Analyze this non-contrast brain CT scan.

Focus ONLY on intracranial structures.

Do NOT analyze:
- skull fractures (unless clearly related to intracranial pathology)
- external artifacts
- non-brain regions

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 sentences
- Abnormality: 3 diseases
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 6 sentences
- Abnormality: 3 diseases
- Recommendation: 3 sentences per section

IF detail_level == "long":
- Findings: 10 sentences
- Abnormality: 3 diseases
- Recommendation: 5 sentences per section
- Add more explanation and reasoning

------------------------
TASK
------------------------
1. Identify visible intracranial abnormalities
2. Describe findings in detailed radiology narrative
3. Estimate risk level
4. Suggest most likely diagnosis (NOT definitive)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in detailed neuroradiology narrative style
- Must follow the selected detail level
- Must read like a professional CT scan report
- Use flowing sentences (NOT bullet points)

Include:
- location (lobar region: frontal, parietal, temporal, occipital, cerebellum, brainstem)
- side (left/right/bilateral)
- density (hyperdense, hypodense, isodense)
- pattern (focal, diffuse, mass effect)
- severity (mild, moderate, severe)

Also mention if present:
- midline shift
- ventricular compression or dilation
- edema
- hemorrhage patterns

Style:
- Use semi-technical language
- Explain complex terms briefly
- Keep understandable for non-medical users

Normal case:
- Clearly state no acute intracranial abnormality
- Mention:
- no hemorrhage
- no mass effect
- no midline shift

------------------------
ABNORMALITY RULES
------------------------
- MUST follow selected detail level (jumlah kondisi)
- MUST list 1–3 most likely conditions
- Use numbered format:

Example:
1. Intracerebral Hemorrhage (perdarahan di dalam otak)
→ Jelaskan secara sederhana

2. Ischemic Stroke (stroke akibat sumbatan pembuluh darah)
→ Jelaskan secara sederhana

3. Brain Edema (pembengkakan jaringan otak)
→ Jelaskan secara sederhana

Requirements:
- Include medical name + simple explanation (Bahasa Indonesia)
- Avoid unexplained jargon

If normal:
"Tidak ditemukan kelainan intrakranial yang signifikan"

------------------------
BOUNDING BOX RULES
------------------------
- Detect ALL suspicious regions
- Maximum 5 boxes
- Tight and minimal
- Focus on abnormal areas only
- Coordinates normalized (0–1)
- If normal: return []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- size of lesion
- location (critical area or not)
- presence of mass effect or midline shift
- number of abnormalities

- Provide explainable reasoning

------------------------
RECOMMENDATION RULES
------------------------
- Write in professional, doctor-oriented clinical language
- Use concise, structured, and medically appropriate terminology
- The output is intended for healthcare professionals, NOT patients

Structure:
- Use 2 parts:
1. Approach (clinical assessment & next steps)
2. Treatment (management plan)

Approach:
- Include clinical reasoning
- Suggest:
- differential diagnosis
- need for clinical correlation
- further investigations (lab, imaging, follow-up)

Treatment:
- Focus on medical management
- Can include:
- pharmacological therapy (e.g. antibiotik, antiinflamasi)
- monitoring plan
- follow-up imaging
- referral if needed

Style:
- Use formal and clinical tone
- Do NOT simplify for layman
- Be direct, precise, and professional


Tone:
- Objective, clinical, and evidence-oriented
- Avoid conversational or reassuring language

Risk-based tone:

LOW RISK:
- Monitoring
- No urgent action

MEDIUM RISK:
- Suggest further imaging / follow-up
- Explain need for observation

HIGH RISK:
- Urgent medical attention
- Explain potential danger clearly

Tone:
- Informative, calm, not robotic

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "lesion_size": "...",
    "location": "...",
    "mass_effect": "...",
    "calculation": "..."
}},
"bboxes": [
    {{"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}}
],
"recommendation": {{
    "approach": "...",
    "treatment": "..."
}}
}}
"""

def get_prompt_endoscopy(detail_level):
    return f"""
Analyze this gastrointestinal endoscopy image.

Focus ONLY on mucosal surfaces.

Do NOT analyze:
- non-relevant background artifacts
- instrument shadows unless obstructing view
- image borders or blur regions

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 sentences
- Abnormality: 3 diseases
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 6 sentences
- Abnormality: 3 diseases
- Recommendation: 3 sentences per section

IF detail_level == "long":
- Findings: 10 sentences
- Abnormality: 3 diseases
- Recommendation: 5 sentences per section
- Add more explanation and reasoning

------------------------
TASK
------------------------
1. Identify visible mucosal abnormalities
2. Describe findings in professional endoscopy narrative
3. Estimate risk level
4. Suggest most likely diagnosis (NOT definitive)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in detailed endoscopic narrative style
- Must follow the selected detail level
- Must read like a professional endoscopy report
- Use flowing sentences (NOT bullet points)

Include:
- location (esophagus, stomach, duodenum, colon if applicable)
- lesion type (erosion, ulcer, polyp, inflammation, bleeding, mass)
- appearance (reddish, pale, elevated, depressed, irregular)
- distribution (localized, multiple, diffuse)
- severity (mild, moderate, severe)

Style:
- Use semi-technical language (medical + simple explanation)
- Avoid overly complex terminology
- Make it understandable for non-medical users

Normal case:
- Clearly state mucosa appears normal
- Mention absence of lesions
- Avoid uncertainty language

------------------------
ABNORMALITY RULES
------------------------
- MUST follow selected detail level (jumlah kondisi)
- MUST list 1–3 most likely conditions
- Use numbered format:

Example:
1. Gastritis (peradangan pada dinding lambung)
→ Jelaskan secara sederhana

2. Peptic Ulcer (luka pada lambung atau duodenum)
→ Jelaskan secara sederhana

3. Colonic Polyp (benjolan kecil di usus besar)
→ Jelaskan secara sederhana

Requirements:
- Include medical name + simple explanation (Bahasa Indonesia)
- Avoid unexplained jargon

If normal:
"Tidak ditemukan kelainan signifikan pada mukosa saluran cerna"

------------------------
BOUNDING BOX RULES
------------------------
- Detect ALL suspicious regions
- Maximum 5 boxes
- Tight and minimal
- Focus only on abnormal mucosal areas
- Coordinates normalized (0–1)
- If normal: return []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- number of lesions
- size and appearance
- distribution (localized vs diffuse)
- severity (inflammation, bleeding, mass)

- Provide simple explainable reasoning

------------------------
RECOMMENDATION RULES
------------------------
- Write in professional, doctor-oriented clinical language
- Use concise, structured, and medically appropriate terminology
- The output is intended for healthcare professionals, NOT patients

Structure:
- Use 2 parts:
1. Approach (clinical assessment & next steps)
2. Treatment (management plan)

Approach:
- Include clinical reasoning
- Suggest:
- differential diagnosis
- need for clinical correlation
- further investigations (lab, imaging, follow-up)

Treatment:
- Focus on medical management
- Can include:
- pharmacological therapy (e.g. antibiotik, antiinflamasi)
- monitoring plan
- follow-up imaging
- referral if needed

Style:
- Use formal and clinical tone
- Do NOT simplify for layman
- Be direct, precise, and professional


Tone:
- Objective, clinical, and evidence-oriented
- Avoid conversational or reassuring language

Risk-based behavior:

LOW RISK:
- Reassure patient
- Suggest monitoring

MEDIUM RISK:
- Suggest follow-up or further evaluation
- Explain need for monitoring

HIGH RISK:
- Suggest urgent medical evaluation
- Explain possible seriousness clearly

Tone:
- Calm, informative, not robotic

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "lesion_count": "...",
    "distribution": "...",
    "severity": "...",
    "calculation": "..."
}},
"bboxes": [
    {{"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}}
],
"recommendation": {{
    "approach": "...",
    "treatment": "..."
}}
}}
"""
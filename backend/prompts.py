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
- Abnormality: 2–3 diseases
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 5–6 sentences
- Abnormality: 3 diseases
- Recommendation: 2–3 sentences per section

IF detail_level == "long":
- Findings: 8–10 sentences
- Abnormality: 3 diseases
- Recommendation: MINIMUM EXACTLY MUST 4–5 sentences per section
- Include clinical reasoning

------------------------
CRITICAL NORMAL DETECTION (VERY IMPORTANT)
------------------------
If the lungs appear NORMAL:
- MUST explicitly state no abnormality
- MUST NOT hallucinate any disease
- MUST NOT guess

------------------------
TASK
------------------------
1. Identify abnormalities in lung regions
2. Describe findings in radiology style
3. Estimate risk level
4. Suggest most likely diseases (NOT diagnosis)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Use professional radiology narrative
- Must follow detail level
- Include:
  - location (left/right, upper/middle/lower)
  - pattern (patchy, diffuse, focal)
  - severity
- Use clear clinical language (doctor-oriented)

Normal case:
- Clearly state no abnormality
- Do NOT speculate

------------------------
ABNORMALITY RULES (STRICT)
------------------------
- MUST return ARRAY format (NOT object)

EXAMPLE format (EXAMPLE ONLY):

"abnormality": [
"1. Pneumonia (infeksi paru-paru) - ditandai dengan adanya opasitas patchy akibat peradangan jaringan paru.",
"2. Tuberculosis (TBC) - infeksi bakteri kronis yang menyebabkan kerusakan jaringan paru dan dapat membentuk kavitas.",
"3. Atelectasis - kondisi paru yang kolaps sebagian sehingga volume paru berkurang."
]

Rules:
- 1–3 diseases ONLY
- Each item MUST be ONE LINE
- Format: 
  Nama penyakit (penjelasan singkat) - deskripsi
- DO NOT use arrow (→)
- DO NOT split into multiple lines
- DO NOT return object

If normal:
"abnormality": ["Tidak ditemukan kelainan signifikan pada paru"]

------------------------
BOUNDING BOX RULES
------------------------
- Max 5 boxes
- Tight & precise
- Only abnormal areas
- Use normalized coordinates (0–1)
- If normal: []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
  - area involvement
  - number of regions
  - intensity

------------------------
RECOMMENDATION RULES
------------------------
- Doctor-oriented (clinical language)
- NOT for patients

Structure:
1. Apporoach
2. Treatment

Approach:
- clinical correlation
- differential diagnosis
- suggest tests (lab / imaging)

Treatment:
- medical management
- follow-up
- referral if needed

Tone:
- clinical, objective, concise

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON.

{{
"findings": "...",
"abnormality": [
"...",
"...",
"..."
],
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
ABNORMALITY RULES (STRICT)
------------------------
- MUST return ARRAY format (NOT object)

EXAMPLE format (EXAMPLE ONLY):

"abnormality": [
"1. Pneumonia (infeksi paru-paru) - ditandai dengan adanya opasitas patchy akibat peradangan jaringan paru.",
"2. Tuberculosis (TBC) - infeksi bakteri kronis yang menyebabkan kerusakan jaringan paru dan dapat membentuk kavitas.",
"3. Atelectasis - kondisi paru yang kolaps sebagian sehingga volume paru berkurang."
]

Rules:
- 1–3 diseases ONLY
- Each item MUST be ONE LINE
- Format: 
  Nama penyakit (penjelasan singkat) - deskripsi
- DO NOT use arrow (→)
- DO NOT split into multiple lines
- DO NOT return object

If normal:
"abnormality": ["Tidak ditemukan kelainan signifikan pada retina"]

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
You are an expert neuroradiologist. Analyze this brain CT scan image.

IMPORTANT — IMAGE ENCODING:
This image is rendered using multi-window blending (RGB channels):
- Red channel = soft tissue window (C=40, W=400) → best for masses, tumors, organs
- Green channel = tumor window (C=75, W=175) → best for neoplasms, ring-enhancing lesions
- Blue channel = brain window (C=40, W=80) → best for edema, hemorrhage

Use ALL three color channels to identify pathology. Do not rely on grayscale appearance alone.

------------------------
CRITICAL CHECKLIST — check each before concluding "normal"
------------------------
1. Hemisphere symmetry: Is the left side IDENTICAL to the right? Any density difference?
2. Mass lesion: Any hyperdense or hypodense focal area that does NOT match normal anatomy?
3. Ring-enhancing pattern: Any area with bright rim and dark center?
4. Midline shift: Is the falx cerebri centered? Any shift > 1mm?
5. Ventricular asymmetry: Are both lateral ventricles equal size?
6. Perilesional edema: Any low-density halo surrounding a denser structure?
7. Sulcal effacement: Are the cortical sulci symmetric or is one side flattened?
8. Basal cisterns: Are they open and symmetric?

If ALL 8 checks are normal → state "no acute intracranial abnormality".
If ANY check is abnormal → describe it in findings, name it in abnormality.

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

IF detail_level == "short":
- Findings: 3 sentences (cover checklist results briefly)
- Abnormality: up to 3 conditions
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 6-8 sentences
- Abnormality: up to 3 conditions
- Recommendation: 3 sentences per section

IF detail_level == "long":
- Findings: 10-12 sentences
- Abnormality: up to 3 conditions
- Recommendation: 5 sentences per section

------------------------
FINDINGS RULES
------------------------
- Systematically go through: frontal → parietal → temporal → occipital → cerebellum → brainstem → ventricles → midline
- Describe each region: density (hyperdense/hypodense/isodense), morphology, borders
- Explicitly state presence or absence of: hemorrhage, mass, edema, shift, herniation
- Use flowing radiology narrative, NOT bullet points
- Semi-technical language with brief Indonesian explanation for non-medical users

------------------------
SCAN TYPE DETECTION
------------------------
First identify what level/region this CT slice shows:
- Brain parenchyma (cortex, white matter, ventricles)
- Skull base (orbits, sinuses, mastoid, petrous bone)
- Posterior fossa (cerebellum, brainstem)

Then analyze accordingly. For skull base slices:
- Check mastoid air cells: symmetric? any opacification or destruction?
- Check sinuses: clear or opacified?
- Check orbits: symmetric? any mass or foreign body?
- Check petrous bone: intact? any lytic lesion?
- Check soft tissue: symmetric density on both sides?

ASYMMETRY IS THE KEY FINDING — any difference left vs right is suspicious.

------------------------
ABNORMALITY RULES
------------------------
- List 1-3 most likely conditions based on findings
- Format:

1. Glioblastoma Multiforme (tumor ganas di otak)
→ Penjelasan singkat bahasa Indonesia

2. Meningioma (tumor di selaput otak, biasanya jinak)
→ Penjelasan singkat

- If truly normal: "Tidak ditemukan kelainan intrakranial yang signifikan"
- NEVER default to normal if any asymmetry was detected

------------------------
BOUNDING BOX RULES
------------------------
- Draw boxes around ALL suspicious regions
- Maximum 5 boxes
- Tight, minimal — only cover the abnormal area
- Normalized coordinates 0.0–1.0
- If truly normal: return []

------------------------
RISK ESTIMATION
------------------------
- Range: 0-100
- Tumor/mass with mass effect → 60-90
- Hemorrhage → 50-80
- Subtle asymmetry without clear mass → 20-40
- Truly normal → 0-15
- Explain the basis for the score

------------------------
RECOMMENDATION RULES
------------------------
For healthcare professionals. Formal clinical tone.

Two sections:
1. Approach: differential diagnosis, clinical correlation, further imaging (MRI with contrast, MRS, perfusion)
2. Treatment: neurosurgical referral, medical management, monitoring

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
    {{"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}}
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
ABNORMALITY RULES (STRICT)
------------------------
- MUST return ARRAY format (NOT object)

EXAMPLE format (EXAMPLE ONLY):

"abnormality": [
"1. Pneumonia (infeksi paru-paru) - ditandai dengan adanya opasitas patchy akibat peradangan jaringan paru.",
"2. Tuberculosis (TBC) - infeksi bakteri kronis yang menyebabkan kerusakan jaringan paru dan dapat membentuk kavitas.",
"3. Atelectasis - kondisi paru yang kolaps sebagian sehingga volume paru berkurang."
]

Rules:
- 1–3 diseases ONLY
- Each item MUST be ONE LINE
- Format: 
  Nama penyakit (penjelasan singkat) - deskripsi
- DO NOT use arrow (→)
- DO NOT split into multiple lines
- DO NOT return object

If normal:
"abnormality": ["Tidak ditemukan kelainan signifikan pada mukosa saluran cerna"]

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


# ================================================================================
# PROMPT MULTI-GAMBAR
# Tambahkan fungsi-fungsi ini ke file prompts.py yang sudah ada
# ================================================================================

def get_prompt_xrays_multi(detail_level, total_images):
    return f"""
You are analyzing {total_images} chest X-ray images from the SAME patient in ONE session.

Your task: Produce ONE COMBINED analysis report covering all {total_images} images together.

Focus ONLY on lung fields across all images. Do NOT analyze heart, bones, or diaphragm.

------------------------
DETAIL LEVEL: {detail_level}
------------------------
IF short: Findings 2-3 sentences, Abnormality 3 diseases, Recommendation 1 sentence each
IF medium: Findings 6-8 sentences, Abnormality 3 diseases, Recommendation 3 sentences each
IF long: Findings 10-12 sentences, Abnormality 3 diseases, Recommendation 5 sentences each

------------------------
COMBINED ANALYSIS RULES
------------------------
- Write ONE unified findings section covering all {total_images} images
- Compare findings across images (e.g. "Image 1 shows..., while Image 2 shows...")
- Identify consistent vs varying abnormalities across images
- Give ONE overall risk score that considers all images together
- Give ONE recommendation based on combined findings

------------------------
BOUNDING BOXES PER IMAGE
------------------------
Return bboxes for EACH image separately in "images_bboxes" array.
Each entry: {{ "image": N, "bboxes": [...] }}
Maximum 5 boxes per image. Normalized coordinates (0-1).
If no abnormality in an image, use empty array [].

Also set top-level "bboxes" = bboxes from image 1 (for backward compatibility).

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
  "findings": "Combined narrative covering all {total_images} images...",
  "abnormality": "...",
  "risk": 0-100,
  "risk_factors": {{
    "area": "...",
    "region_count": "...",
    "intensity": "...",
    "calculation": "Combined risk from {total_images} images: ..."
  }},
  "bboxes": [...],
  "images_bboxes": [
    {{ "image": 1, "bboxes": [...] }},
    {{ "image": 2, "bboxes": [...] }}
  ],
  "recommendation": {{
    "approach": "...",
    "treatment": "..."
  }}
}}
"""


def get_prompt_fundus_multi(detail_level, total_images):
    return f"""
You are analyzing {total_images} retinal fundus images from the SAME patient in ONE session.

Your task: Produce ONE COMBINED analysis report covering all {total_images} images.

Focus ONLY on retinal structures.

------------------------
DETAIL LEVEL: {detail_level}
------------------------
IF short: Findings 2-3 sentences, Abnormality 3 diseases, Recommendation 1 sentence each
IF medium: Findings 6-8 sentences, Abnormality 3 diseases, Recommendation 3 sentences each
IF long: Findings 10-12 sentences, Abnormality 3 diseases, Recommendation 5 sentences each

------------------------
COMBINED ANALYSIS RULES
------------------------
- Write ONE unified findings section covering all {total_images} images
- Note which eye each image represents if identifiable (left/right)
- Compare retinal findings across images
- Give ONE overall risk score considering all images
- Give ONE recommendation based on combined findings

------------------------
BOUNDING BOXES PER IMAGE
------------------------
Return bboxes for EACH image separately in "images_bboxes" array.
Each entry: {{ "image": N, "bboxes": [...] }}
Maximum 5 boxes per image. Normalized coordinates (0-1).

Also set top-level "bboxes" = bboxes from image 1.

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
  "findings": "Combined narrative covering all {total_images} images...",
  "abnormality": "...",
  "risk": 0-100,
  "risk_factors": {{
    "lesion_count": "...",
    "distribution": "...",
    "severity": "...",
    "calculation": "Combined from {total_images} images: ..."
  }},
  "bboxes": [...],
  "images_bboxes": [
    {{ "image": 1, "bboxes": [...] }},
    {{ "image": 2, "bboxes": [...] }}
  ],
  "recommendation": {{
    "approach": "...",
    "treatment": "..."
  }}
}}
"""


def get_prompt_ct_multi(detail_level, total_images):
    return f"""
You are analyzing {total_images} brain CT scan slices/images from the SAME patient in ONE session.

Your task: Produce ONE COMBINED analysis report covering all {total_images} images.

Focus ONLY on intracranial structures.

------------------------
DETAIL LEVEL: {detail_level}
------------------------
IF short: Findings 2-3 sentences, Abnormality 3 conditions, Recommendation 1 sentence each
IF medium: Findings 6-8 sentences, Abnormality 3 conditions, Recommendation 3 sentences each
IF long: Findings 10-12 sentences, Abnormality 3 conditions, Recommendation 5 sentences each

------------------------
COMBINED ANALYSIS RULES
------------------------
- Write ONE unified findings section covering all {total_images} CT slices
- Describe findings across slices/planes (axial, coronal, sagittal if identifiable)
- Note progression or distribution of findings across slices
- Give ONE overall risk score considering all images
- Give ONE recommendation based on combined findings

------------------------
BOUNDING BOXES PER IMAGE
------------------------
Return bboxes for EACH image separately in "images_bboxes" array.
Each entry: {{ "image": N, "bboxes": [...] }}
Maximum 5 boxes per image. Normalized coordinates (0-1).

Also set top-level "bboxes" = bboxes from image 1.

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
  "findings": "Combined narrative covering all {total_images} CT slices...",
  "abnormality": "...",
  "risk": 0-100,
  "risk_factors": {{
    "lesion_size": "...",
    "location": "...",
    "mass_effect": "...",
    "calculation": "Combined from {total_images} slices: ..."
  }},
  "bboxes": [...],
  "images_bboxes": [
    {{ "image": 1, "bboxes": [...] }},
    {{ "image": 2, "bboxes": [...] }}
  ],
  "recommendation": {{
    "approach": "...",
    "treatment": "..."
  }}
}}
"""


def get_prompt_combine_results(detail_level, analysis_type, per_image_results):
    """
    Prompt untuk menggabungkan hasil analisis per-gambar menjadi satu laporan.
    per_image_results: list of dict hasil JSON dari masing-masing gambar
    """
    results_text = ""
    for i, r in enumerate(per_image_results, start=1):
        results_text += f"""
--- IMAGE {i} ---
Findings: {r.get('findings', '-')}
Abnormality: {r.get('abnormality', '-')}
Risk: {r.get('risk', 0)}
Risk Factors: {r.get('risk_factors', {})}
Bboxes count: {len(r.get('bboxes', []))}
Recommendation Approach: {r.get('recommendation', {}).get('approach', '-')}
Recommendation Treatment: {r.get('recommendation', {}).get('treatment', '-')}
"""
 
    detail_rules = {
        "short": "Findings: 3-4 sentences. Recommendation: 1-2 sentences each.",
        "medium": "Findings: 6-8 sentences. Recommendation: 3 sentences each.",
        "long": "Findings: 10-12 sentences. Recommendation: 5 sentences each.",
    }.get(detail_level, "Findings: 6-8 sentences. Recommendation: 3 sentences each.")
 
    risk_key_hint = ""
    if "xray" in analysis_type.lower() or "x-ray" in analysis_type.lower():
        risk_key_hint = '"area": "...", "region_count": "...", "intensity": "...", "calculation": "..."'
    elif "fundus" in analysis_type.lower() or "retina" in analysis_type.lower():
        risk_key_hint = '"lesion_count": "...", "distribution": "...", "severity": "...", "calculation": "..."'
    elif "ct" in analysis_type.lower():
        risk_key_hint = '"lesion_size": "...", "location": "...", "mass_effect": "...", "calculation": "..."'
    elif "endoscopy" in analysis_type.lower():
        risk_key_hint = '"lesion_count": "...", "distribution": "...", "severity": "...", "calculation": "..."'
    elif "oto" in analysis_type.lower() or "otoscopic" in analysis_type.lower():
        risk_key_hint = '"membrane_status": "...", "canal_condition": "...", "signs_of_infection": "...", "calculation": "..."'
    else:
        risk_key_hint = '"area": "...", "region_count": "...", "intensity": "...", "calculation": "..."'
 
    return f"""
You are a radiologist/specialist creating ONE UNIFIED clinical report.
 
You have received individual AI analysis results for {len(per_image_results)} medical images from the SAME patient session.
 
Your task: Synthesize these results into ONE comprehensive combined report.
 
------------------------
INDIVIDUAL ANALYSIS RESULTS
------------------------
{results_text}
 
------------------------
SYNTHESIS RULES
------------------------
- Write ONE unified "findings" narrative that covers all images
- Reference specific images when noting differences (e.g. "Gambar 1 menunjukkan..., sementara Gambar 2...")
- Identify patterns consistent across all images
- Note any contradictions or varying findings between images
- Give ONE overall risk score (weighted average, favor higher risk if any image is high)
- Give ONE unified recommendation
- IMPORTANT: If ANY single image flags a mass, tumor, or asymmetry — include it in the combined findings.
  Do NOT average it away just because other slices appear normal.
  A tumor visible in 1 out of 4 slices is still a tumor.
 
Detail level: {detail_level}
{detail_rules}
 
------------------------
LANGUAGE
------------------------
- Findings: professional radiology/clinical narrative style
- Abnormality: numbered list with medical name + simple Indonesian explanation
- Recommendation: formal clinical tone for healthcare professionals
 
------------------------
RISK SCORE
------------------------
- Range: 0-100
- Consider the HIGHEST risk finding across all images
- If images disagree, use the highest risk as the combined score
- Explain reasoning briefly in "calculation"
 
------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.
 
{{
  "findings": "Combined narrative covering all {len(per_image_results)} images...",
  "abnormality": "...",
  "risk": 0,
  "risk_factors": {{
    {risk_key_hint}
  }},
  "bboxes": [],
  "recommendation": {{
    "approach": "...",
    "treatment": "..."
  }}
}}
"""

def get_prompt_breast_usg(detail_level):
    return f"""
Analyze this breast ultrasound (USG mammae) image.

Focus ONLY on breast tissue structures.

Do NOT analyze:
- image artifacts (noise, probe shadow)
- annotations or labels
- image borders

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 kalimat
- Abnormality: maksimal 1–2 kondisi
- Recommendation: 1 kalimat per bagian

IF detail_level == "medium":
- Findings: 5–6 kalimat
- Abnormality: maksimal 2 kondisi
- Recommendation: 2–3 kalimat per bagian

IF detail_level == "long":
- Findings: 8–10 kalimat (WAJIB, tidak boleh kurang)
- Abnormality: maksimal 3 kondisi (HANYA jika ada lesi jelas)
- Recommendation:
  - Approach: minimal 5 kalimat
  - Treatment: minimal 5 kalimat
  - Harus mencantumkan alasan klinis (reasoning)

------------------------
CRITICAL NORMAL DETECTION (VERY STRICT)
------------------------
Sebelum menyimpulkan abnormalitas, tentukan terlebih dahulu:

Apakah terdapat lesi yang JELAS dan DEFINITIF?

Jika TIDAK:
- WAJIB diklasifikasikan sebagai NORMAL
- DILARANG menyebutkan penyakit
- DILARANG membuat dugaan

Kriteria NORMAL:
- Tidak ada massa yang jelas
- Tidak ada batas lesi tegas
- Tidak ada bayangan posterior mencurigakan
- Tidak ada distorsi arsitektur

Jika hanya ditemukan:
- tekstur heterogen ringan
- variasi jaringan
- pola tidak teratur ringan

→ Ini adalah VARIASI NORMAL, BUKAN penyakit.

Jika NORMAL:
- findings harus menyatakan jaringan normal
- abnormality HARUS:

"abnormality": ["Tidak ditemukan kelainan signifikan pada jaringan payudara"]

- risk HARUS 0–10
- bboxes HARUS []

Pelanggaran aturan ini tidak diperbolehkan.

------------------------
TASK
------------------------
1. Identifikasi apakah ada lesi yang jelas
2. Deskripsikan temuan dalam gaya radiologi USG
3. Estimasi tingkat risiko
4. HANYA jika ada lesi → berikan kemungkinan diagnosis
5. Berikan rekomendasi klinis

------------------------
FINDINGS RULES
------------------------
- Narasi radiologi profesional (Bahasa Indonesia)
- Bukan bullet point
- Harus mengalir seperti laporan dokter

Wajib mencakup:
- lokasi (payudara kiri/kanan, kuadran jika memungkinkan)
- jenis lesi (massa, kista, dll) HANYA jika ada
- bentuk (oval, bulat, tidak teratur)
- margin (tegas / tidak tegas)
- echogenicity (hipoekoik, hiperekoik, anekoik, heterogen)
- fitur posterior (enhancement / shadowing)
- distribusi (lokal / difus)
- tingkat kecurigaan

Jika NORMAL:
- sebutkan jaringan homogen / tanpa lesi
- jangan gunakan bahasa ragu

------------------------
ABNORMALITY RULES (STRICT)
------------------------
- HARUS berupa ARRAY
- HANYA diisi jika ADA lesi jelas
- Jika tidak ada → gunakan format normal

Format:
"abnormality": [
"1. Nama penyakit (penjelasan singkat) - definisi singkat penyakit"
]

Aturan:
- WAJIB MEMBERIKAN 3 kondisi
- Satu baris per kondisi
- Tidak boleh paragraf
- Tidak boleh narasi panjang
- Tidak boleh menggunakan tanda panah

------------------------
BOUNDING BOX RULES
------------------------
- Maksimal 5 box
- Hanya area abnormal
- Koordinat 0–1
- Jika normal: []

------------------------
RISK ESTIMATION (STRICT)
------------------------
- Range: 0–100

Jika NORMAL:
→ 0–10

Jika abnormal ringan:
→ 20–40

Jika mencurigakan:
→ 40–70

Jika sangat mencurigakan:
→ 70–90

- Harus konsisten dengan temuan
- Tidak boleh asal nilai tengah

------------------------
RECOMMENDATION RULES
------------------------
- Bahasa klinis profesional (Bahasa Indonesia)

Struktur:
1. Approach
2. Treatment

Approach:
- korelasi klinis
- pertimbangan BI-RADS (jika relevan)
- imaging tambahan (mamografi / MRI)
- indikasi biopsi

Treatment:
- follow-up imaging
- FNAB / core biopsy jika perlu
- rujukan spesialis

Jika NORMAL:
- sarankan observasi rutin saja

------------------------
FINAL VALIDATION (MANDATORY)
------------------------
Sebelum output:
- Jika tidak ada lesi → pastikan abnormality kosong
- Pastikan bahasa Indonesia
- Pastikan panjang sesuai detail level
- Pastikan risk sesuai kondisi

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON.

{{
"findings": "...",
"abnormality": [
"..."
],
"risk": 0-100,
"risk_factors": {{
    "lesion_character": "...",
    "margin": "...",
    "echogenicity": "...",
    "calculation": "Alasan pemberian skor risiko"
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

def get_prompt_skin_lesion(detail_level):
    return f"""
Analyze this skin lesion image.

Focus ONLY on visible skin lesion.

Do NOT analyze:
- background skin outside lesion
- image artifacts (lighting, blur)
- labels or markings

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 sentences
- Abnormality: 2 diseases
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 5 sentences
- Abnormality: 3 diseases
- Recommendation: 2 sentences per section

IF detail_level == "long":
- Findings: 8–10 sentences
- Abnormality: 3 diseases
- Recommendation: 3–4 sentences per section
- Include deeper visual reasoning

------------------------
TASK
------------------------
1. Identify visible abnormalities on the skin lesion
2. Describe findings in dermatology-style narrative
3. Estimate risk level
4. Suggest most likely disease(s) (NOT definitive diagnosis)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in dermatology narrative style
- Must follow selected detail level
- Use flowing sentences (NOT bullet points)

Include:
- lesion location (centered / localized area)
- color (brown, black, red, mixed, uneven)
- shape (round, oval, irregular)
- border (well-defined, irregular, blurred)
- symmetry (symmetrical vs asymmetrical)
- texture (smooth, crusted, ulcerated, raised)
- size estimation (small, medium, large)
- distribution (single lesion / multiple)
- severity (mild, moderate, suspicious)

Style:
- Semi-technical language (medical + simple explanation)
- Avoid overly complex jargon
- Still understandable

Normal case:
- Clearly state lesion appears benign
- Mention symmetry and regular borders
- Avoid uncertainty language

------------------------
ABNORMALITY RULES
------------------------
- MUST list 1–3 most likely diseases
- Use numbered format:

Example:
1. Melanoma (kanker kulit berbahaya)
→ Jelaskan secara sederhana

2. Nevus (tahi lalat jinak)
→ Jelaskan secara sederhana

3. Basal Cell Carcinoma (kanker kulit tipe ringan)
→ Jelaskan secara sederhana

Requirements:
- Include medical name + penjelasan Bahasa Indonesia
- Hindari istilah tanpa penjelasan

If normal:
"Tidak ditemukan kelainan kulit yang mencurigakan"

------------------------
BOUNDING BOX RULES
------------------------
- Detect ALL suspicious lesions
- Maximum 3 boxes
- Tight and minimal
- Focus only on lesion area
- Coordinates normalized (0–1)
- If normal: return []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- asymmetry (tidak simetris → lebih berisiko)
- border irregularity
- color variation (multi-color → lebih tinggi)
- lesion size
- texture abnormality (ulcer / crust)

- Provide reasoning explanation

------------------------
RECOMMENDATION RULES
------------------------
- Write in doctor-oriented clinical style
- NOT for patients
- Use concise medical explanation

Structure:
1. Approach (penilaian klinis & langkah lanjut)
2. Treatment (opsi penanganan)

Approach:
- Evaluasi klinis dermatoskopi jika perlu
- Pertimbangkan biopsy jika mencurigakan
- Follow-up jika low risk

Treatment:
- Observasi untuk lesi jinak
- Eksisi / biopsy untuk lesi mencurigakan
- Rujukan ke dermatolog

Tone:
- Profesional, klinis, tidak santai

Risk-based behavior:

LOW RISK:
- Monitoring rutin

MEDIUM RISK:
- Evaluasi lanjutan / dermatoscopy

HIGH RISK:
- Biopsy atau rujukan segera

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "symmetry": "...",
    "border": "...",
    "color": "...",
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

def get_prompt_ecg(detail_level):
    return f"""
Analyze this ECG (Electrocardiogram) image.

Focus ONLY on waveform patterns.

Do NOT analyze:
- background grid aesthetics
- text labels unless related to waveform
- image borders or artifacts

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 sentences
- Abnormality: 2 conditions
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 5 sentences
- Abnormality: 3 conditions
- Recommendation: 2 sentences per section

IF detail_level == "long":
- Findings: 8–10 sentences
- Abnormality: 3 conditions
- Recommendation: 3–4 sentences per section
- Include rhythm reasoning

------------------------
CRITICAL NORMAL DETECTION (STRICT)
------------------------
Before identifying any abnormality, you MUST first determine whether the ECG is clearly abnormal.

If the ECG shows:
- regular rhythm
- consistent RR intervals
- visible P waves before each QRS
- normal QRS duration
- no significant ST elevation or depression
- no abnormal T wave inversion

Then it MUST be classified as NORMAL.

STRICT RULES:
- DO NOT force abnormality detection
- DO NOT speculate or assume disease
- DO NOT list any condition if findings are within normal variation

If NORMAL:
- findings MUST clearly state "normal sinus rhythm"
- abnormality MUST be:

"abnormality": ["Tidak ditemukan kelainan pada pola EKG"]

- risk MUST be between 0–10
- bboxes MUST be []

Any violation of this rule is NOT allowed.

------------------------
TASK
------------------------
1. Identify waveform abnormalities
2. Describe findings in cardiology-style narrative
3. Estimate risk level
4. Suggest most likely condition(s) (NOT definitive)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in cardiology narrative style
- Use flowing sentences

Include:
- heart rhythm (regular / irregular)
- heart rate (slow / normal / fast)
- P wave presence
- QRS complex width (normal / widened)
- ST segment (elevated / depressed / normal)
- T wave (inverted / normal)
- pattern consistency

Style:
- Semi-technical but clear
- Avoid overly complex jargon

Normal case:
- Clearly state normal sinus rhythm
- No abnormalities

------------------------
ABNORMALITY RULES
------------------------
- MUST list 1–3 most likely conditions

Example:
1. Atrial Fibrillation (irama jantung tidak teratur) - Penjelasan sederhana

If normal:
"Tidak ditemukan kelainan pada pola EKG"

------------------------
BOUNDING BOX RULES
------------------------
- Detect abnormal waveform regions
- Maximum 3 boxes
- Focus on waveform anomalies
- If normal: []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- rhythm irregularity
- ST abnormalities
- QRS abnormality
- waveform consistency

------------------------
RECOMMENDATION RULES
------------------------
- Doctor-oriented clinical language

Structure:
1. Approach
2. Treatment

Approach:
- Suggest ECG confirmation
- Consider clinical symptoms

Treatment:
- Monitoring / medication / referral

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "rhythm": "...",
    "qrs": "...",
    "st_segment": "...",
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

def get_prompt_abdominal_usg(detail_level):
    return f"""
Analyze this abdominal ultrasound (USG abdomen) image.

Focus ONLY on visible abdominal organ structures.

Do NOT analyze:
- probe artifacts or noise
- image borders or annotations
- unrelated background

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

Rules:

IF detail_level == "short":
- Findings: 2 sentences
- Abnormality: 2 diseases
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 5 sentences
- Abnormality: 3 diseases
- Recommendation: 2 sentences per section

IF detail_level == "long":
- Findings: 8–10 sentences
- Abnormality: 3 diseases
- Recommendation: 3–4 sentences per section
- Include deeper clinical reasoning

------------------------
TASK
------------------------
1. Identify visible abnormalities in abdominal organs
2. Describe findings in radiology ultrasound narrative
3. Estimate risk level
4. Suggest most likely diagnosis (NOT definitive)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in professional ultrasound narrative style
- Use flowing sentences (NOT bullet points)
- Follow selected detail level

Include:
- organ (liver, gallbladder, kidney, spleen if visible)
- echogenicity (hyperechoic, hypoechoic, anechoic, heterogeneous)
- lesion type (mass, cyst, stone, fluid collection)
- shape (round, irregular)
- border (well-defined / ill-defined)
- posterior acoustic features (shadowing, enhancement, none)
- distribution (focal / diffuse)
- severity (mild / moderate / suspicious)

Style:
- Semi-technical language (medical + clear explanation)
- Avoid overly complex jargon

Normal case:
- Clearly state no significant abnormality
- Describe normal echotexture if visible

------------------------
ABNORMALITY RULES
------------------------
- MUST list 1–3 most likely conditions
- Use numbered format

Example:
1. Fatty Liver (penumpukan lemak pada hati)
→ Jelaskan sederhana

2. Cholelithiasis (batu empedu)
→ Jelaskan sederhana

3. Renal Stone (batu ginjal)
→ Jelaskan sederhana

Requirements:
- Medical name + penjelasan Bahasa Indonesia
- Hindari istilah tanpa penjelasan

If normal:
"Tidak ditemukan kelainan signifikan pada organ abdomen"

------------------------
BOUNDING BOX RULES
------------------------
- Detect suspicious regions only
- Maximum 5 boxes
- Tight and minimal
- Coordinates normalized (0–1)
- If normal: return []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- lesion type (solid > cystic → lebih berisiko)
- echogenicity abnormal
- border irregularity
- posterior shadowing (stone → tinggi)
- organ involvement

- Provide explainable reasoning

------------------------
RECOMMENDATION RULES
------------------------
- Doctor-oriented clinical language
- Not for patients

Structure:
1. Approach (evaluasi & langkah lanjut)
2. Treatment (manajemen)

Approach:
- Korelasi dengan gejala klinis
- Pertimbangkan pemeriksaan lanjutan (CT / MRI / lab)
- Follow-up imaging jika perlu

Treatment:
- Observasi untuk kasus ringan
- Terapi medis atau intervensi untuk kondisi spesifik
- Rujukan spesialis jika mencurigakan

Tone:
- Profesional, objektif, klinis

Risk-based behavior:

LOW RISK:
- Monitoring rutin

MEDIUM RISK:
- Evaluasi lanjutan

HIGH RISK:
- Pemeriksaan lanjutan segera / rujukan spesialis

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "organ": "...",
    "lesion_type": "...",
    "echogenicity": "...",
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
def get_prompt_otoscopic(detail_level):
    return f"""
Analyze this otoscopic image of the ear canal and tympanic membrane (eardrum).

Focus ONLY on visible ear structures: ear canal, tympanic membrane, and any visible middle ear features.

Do NOT analyze:
- otoscope artifacts (light reflex from instrument is NORMAL — do not flag it as pathology)
- image vignetting or dark borders

------------------------
STEP 0 — VISIBILITY CHECK (DO THIS FIRST)
------------------------
Before any diagnosis, assess: Is the tympanic membrane VISIBLE?

Check the ear canal:
- If the canal is filled with dark brown/black/yellow material blocking the view → this is CERUMEN IMPACTION
- If only partial membrane is visible → state partial view and analyze what is visible

IF CERUMEN IMPACTION (membrane NOT visible):
- findings: Describe the cerumen — color, consistency (dry/moist), degree of obstruction
- abnormality: "1. Serumen Prop (penumpukan kotoran telinga)\\n→ Liang telinga tersumbat oleh kotoran telinga yang mengeras, gendang telinga tidak dapat dievaluasi."
- risk: 15–25 (low — not dangerous but needs removal)
- bboxes: box around the cerumen mass
- recommendation approach: Ear irrigation or manual removal by ENT, reassess after clearance
- DO NOT diagnose any middle ear condition (OMA, effusion, etc.) if membrane is not visible
- STOP HERE and return JSON immediately

------------------------
DETAIL LEVEL CONTROL
------------------------
The output detail level is: {detail_level}

IF detail_level == "short":
- Findings: 2–3 sentences
- Abnormality: 2 conditions
- Recommendation: 1 sentence per section

IF detail_level == "medium":
- Findings: 5–6 sentences
- Abnormality: 3 conditions
- Recommendation: 2–3 sentences per section

IF detail_level == "long":
- Findings: 8–10 sentences
- Abnormality: 3 conditions
- Recommendation: 4–5 sentences per section

------------------------
SYSTEMATIC CHECKLIST (only if membrane IS visible)
------------------------
1. Tympanic membrane color: pearly gray/white (normal) vs red/yellow/opaque (abnormal)?
2. Light reflex: present and sharp (normal cone of light) vs absent/distorted?
3. Membrane position: neutral vs retracted vs bulging?
4. Perforation: any visible hole or defect?
5. Fluid/effusion: amber/dark color visible behind membrane?
6. Ear canal: clean vs inflamed, swollen, discharge present?
7. Landmarks: malleus handle, umbo visible and normal?
8. Surface texture: smooth vs granular, vascular, scarred, white chalky plaques?

ASYMMETRY OR ABNORMALITY IN ANY CHECK → describe and diagnose it.
DO NOT default to "normal" if any check is abnormal.

------------------------
FINDINGS RULES
------------------------
- Write in professional ENT/otolaryngology narrative style
- Use flowing sentences (NOT bullet points)
- Systematically cover all 8 checklist items

Normal case:
- State tympanic membrane appears normal
- Confirm sharp light reflex and intact landmarks
- Avoid uncertainty language

------------------------
ABNORMALITY RULES
------------------------
List 1–3 most likely conditions. PRIORITY: the condition most consistent with visual appearance goes FIRST.

Priority guide:
- White/chalky plaques on membrane → Tympanosclerosis FIRST (not OMA)
- Canal fully filled brown/black → Cerumen Impaction FIRST (do NOT diagnose middle ear)
- Bulging red/opaque membrane → OMA FIRST
- Amber/yellow color behind membrane → Effusion FIRST
- Red inflamed canal, intact membrane → Otitis Externa FIRST

Format:
1. [Condition name] ([Indonesian explanation])
→ Simple explanation in Bahasa Indonesia

If normal: "Tidak ditemukan kelainan signifikan pada membran timpani dan liang telinga"

------------------------
BOUNDING BOX RULES
------------------------
- Box ALL visible abnormal regions
- Maximum 5 boxes
- Box: perforation, bulging, white plaques, cerumen, discharge, inflammation
- DO NOT box the normal light reflex cone
- Normalized coordinates 0.0–1.0
- If normal: []

------------------------
RISK ESTIMATION
------------------------
Range: 0–100
- Normal: 0–15
- Cerumen impaction only: 15–25
- Mild retraction / minor scarring / tympanosclerosis: 20–35
- Effusion without active infection: 35–50
- AOM with bulging membrane: 55–75
- Large perforation / cholesteatoma: 75–90

Explain the score basis clearly in "calculation".

------------------------
RISK FACTORS FORMAT — CRITICAL
------------------------
You MUST use EXACTLY these 4 keys. No other keys allowed:

"area": The specific anatomical area affected.
  Examples: "Membran timpani anterior-inferior", "Seluruh liang telinga", "Membran timpani posterior-superior", "Tidak ada area abnormal"

"region_count": Number and description of abnormal regions.
  Examples: "2 bercak putih pada membran", "1 massa serumen menutupi seluruh kanal", "Tidak ada", "3 area hiperemis"

"intensity": Severity level with brief description.
  Examples: "Ringan - bercak kecil tanpa tanda infeksi", "Sedang - inflamasi aktif", "Berat - membran timpani tidak terlihat"

"calculation": 1–2 sentences explaining HOW the risk score number was derived.
  Example: "Skor 65 ditetapkan karena ditemukan membran timpani yang menonjol (bulging) disertai kemerahan difus, mengindikasikan OMA aktif yang memerlukan penanganan segera."

NEVER leave any of these 4 fields as "-" or empty. Always provide descriptive content.

------------------------
RECOMMENDATION RULES
------------------------
For ENT/primary care professionals. Formal clinical tone.

1. Approach: clinical correlation (otalgia, hearing loss, duration, fever, discharge history), audiometry/tympanometry if indicated, follow-up interval
2. Treatment: specific management — antibiotics if bacterial OMA, cerumen removal technique, ear drops for OE, ENT referral if needed

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown, no trailing text after the closing brace.

{{
  "findings": "...",
  "abnormality": "...",
  "risk": 0,
  "risk_factors": {{
    "area": "...",
    "region_count": "...",
    "intensity": "...",
    "calculation": "..."
  }},
  "bboxes": [
    {{"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0}}
  ],
  "recommendation": {{
    "approach": "...",
    "treatment": "..."
  }}
}}
"""
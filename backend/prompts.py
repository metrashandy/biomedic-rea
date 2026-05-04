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
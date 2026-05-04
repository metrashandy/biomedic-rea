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
1. Identify visible breast abnormalities
2. Describe findings in professional radiology (ultrasound) style
3. Estimate risk level
4. Suggest most likely diagnosis (NOT definitive)
5. Provide clinical recommendation

------------------------
FINDINGS RULES
------------------------
- Write in detailed breast ultrasound narrative style
- Must follow the selected detail level
- Must read like a professional radiology report
- Use flowing sentences (NOT bullet points)

Include:
- location (left/right breast, quadrant if possible)
- lesion type (mass, cyst, solid lesion, calcification, ductal dilation)
- shape (round, oval, irregular)
- margin (well-defined, ill-defined, spiculated)
- echogenicity (hypoechoic, hyperechoic, anechoic, heterogeneous)
- posterior features (enhancement, shadowing, none)
- vascularity (if suspected from pattern)
- distribution (localized, multiple, diffuse)
- severity (mild, moderate, suspicious)

Style:
- Use semi-technical language (medical + simple explanation)
- Avoid overly complex jargon
- Make it understandable for non-medical users

Normal case:
- Clearly state no suspicious lesion identified
- Mention homogeneous parenchyma if appropriate
- Avoid uncertainty language

------------------------
ABNORMALITY RULES
------------------------
- MUST follow selected detail level (jumlah penyakit)
- MUST list 1–3 most likely conditions
- Use numbered format:

Example:
1. Fibroadenoma (benjolan jinak pada payudara)
→ Jelaskan dengan bahasa sederhana

2. Breast cyst (kista berisi cairan)
→ Jelaskan dengan bahasa sederhana

3. Breast carcinoma (kanker payudara)
→ Jelaskan dengan bahasa sederhana

Requirements:
- Each disease MUST include:
- medical name
- simple explanation (Bahasa Indonesia)
- Avoid unexplained medical terms

If normal:
"Tidak ditemukan kelainan signifikan pada jaringan payudara"

------------------------
BOUNDING BOX RULES
------------------------
- Detect ALL suspicious regions
- Maximum 5 boxes
- Tight and minimal
- Focus only on abnormal areas
- Coordinates normalized (0–1)
- If normal: return []

------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Based on:
- lesion shape (irregular lebih tinggi risiko)
- margin (spiculated / ill-defined → lebih tinggi)
- echogenicity (heterogeneous / hypoechoic solid → lebih tinggi)
- posterior shadowing (meningkatkan risiko keganasan)
- number of lesions

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
- BI-RADS consideration (if applicable)
- correlation with clinical exam
- need for further imaging (mammography, MRI)
- biopsy if suspicious

Treatment:
- Focus on medical management
- Can include:
- follow-up imaging
- FNAB / core biopsy
- surgical referral if needed

Style:
- Use formal and clinical tone
- Do NOT simplify for layman
- Be direct, precise, and professional

Tone:
- Objective, clinical, and evidence-oriented
- Avoid conversational language

Risk-based behavior:

LOW RISK:
- Suggest routine follow-up imaging

MEDIUM RISK:
- Suggest closer monitoring or additional imaging

HIGH RISK:
- Suggest biopsy or urgent specialist referral

------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.

{{
"findings": "...",
"abnormality": "...",
"risk": 0-100,
"risk_factors": {{
    "lesion_character": "...",
    "margin": "...",
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
1. Atrial Fibrillation (irama jantung tidak teratur)
→ Penjelasan sederhana

2. Tachycardia (denyut jantung cepat)
→ Penjelasan sederhana

3. Myocardial Infarction (serangan jantung)
→ Penjelasan sederhana

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
- cerumen (earwax) unless it obstructs the view significantly
 
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
- Findings: 5–6 sentences
- Abnormality: 3 conditions
- Recommendation: 2–3 sentences per section
 
IF detail_level == "long":
- Findings: 8–10 sentences
- Abnormality: 3 conditions
- Recommendation: 4–5 sentences per section
- Include detailed structural reasoning
 
------------------------
TASK
------------------------
1. Evaluate tympanic membrane integrity and appearance
2. Assess ear canal condition
3. Describe findings in professional otolaryngology narrative
4. Estimate risk level
5. Suggest most likely diagnosis (NOT definitive)
6. Provide clinical recommendation
 
------------------------
SYSTEMATIC CHECKLIST — evaluate each before concluding "normal"
------------------------
1. Tympanic membrane color: normal (pearly gray/white) vs abnormal (red, yellow, blue, opaque)?
2. Light reflex: present and sharp (normal cone of light) vs absent/distorted?
3. Tympanic membrane position: neutral vs retracted vs bulging?
4. Perforation: any hole or defect visible?
5. Fluid behind eardrum: any amber/dark color suggesting effusion?
6. Ear canal: clean vs inflamed, swollen, discharge, foreign body?
7. Landmarks: malleus handle, umbo, pars flaccida visible and normal?
8. Surface: smooth vs granular, vascular, scarred?
 
If ALL 8 checks are normal → state "normal tympanic membrane appearance".
If ANY check is abnormal → describe and name it.
 
------------------------
FINDINGS RULES
------------------------
- Write in detailed otolaryngology narrative style
- Must follow selected detail level
- Use flowing sentences (NOT bullet points)
- Must read like a professional ENT examination report
 
Include:
- tympanic membrane color and transparency
- membrane position (neutral / retracted / bulging)
- light reflex status (present, sharp / absent / distorted)
- visible landmarks (malleus, umbo)
- ear canal condition (clean, inflamed, discharge)
- presence/absence of perforation
- signs of fluid or infection
 
Style:
- Semi-technical language (medical + simple Indonesian explanation for non-medical users)
- Avoid overly complex jargon without explanation
 
Normal case:
- Clearly state tympanic membrane appears normal
- Mention sharp light reflex and intact membrane
- Avoid uncertainty language
 
------------------------
ABNORMALITY RULES
------------------------
- MUST list 1–3 most likely conditions based on findings
- Use numbered format:
 
Example:
1. Otitis Media Akut (infeksi telinga tengah akut)
→ Penjelasan sederhana Bahasa Indonesia
 
2. Otitis Media dengan Efusi / Glue Ear (cairan di telinga tengah tanpa infeksi aktif)
→ Penjelasan sederhana
 
3. Perforasi Membran Timpani (robek pada gendang telinga)
→ Penjelasan sederhana
 
Other possible conditions to consider:
- Otitis Externa (infeksi liang telinga)
- Cholesteatoma (pertumbuhan kulit abnormal di telinga tengah)
- Tympanosclerosis (jaringan parut pada gendang telinga)
- Retracted Eardrum (gendang telinga tertarik ke dalam)
- Hemotympanum (darah di balik gendang telinga)
 
If normal:
"Tidak ditemukan kelainan signifikan pada membran timpani dan liang telinga"
 
------------------------
BOUNDING BOX RULES
------------------------
- Draw boxes around ALL suspicious / abnormal regions
- Maximum 5 boxes
- Prioritize: perforation, bulging area, fluid line, inflammation, foreign body
- Tight and minimal — cover only the abnormal area
- Normalized coordinates 0.0–1.0
- If truly normal: return []
 
Do NOT box:
- the normal light reflex cone
- the otoscope lens border/vignette
- cerumen that is clearly normal/minor
 
------------------------
RISK ESTIMATION
------------------------
- Range: 0–100
- Low (0–20): Normal or minor cerumen
- Low-Medium (20–40): Mild retraction, minor canal inflammation
- Medium (40–60): Otitis media with effusion, mild perforation
- High (60–80): Acute otitis media with bulging, active discharge
- Very High (80–100): Cholesteatoma, large perforation, hemotympanum
 
Provide explainable reasoning for the score.
 
------------------------
RECOMMENDATION RULES
------------------------
- Write in professional, doctor-oriented clinical language (ENT / primary care)
- NOT for patients
- Concise and structured
 
Structure:
1. Approach: clinical assessment, audiometry if indicated, further evaluation
2. Treatment: management plan
 
Approach:
- Clinical correlation with symptoms (otalgia, hearing loss, discharge, fever)
- Consider pure tone audiometry / tympanometry
- Follow-up interval
 
Treatment:
- Antibiotics if bacterial otitis media suspected
- Decongestants / nasal spray for Eustachian tube dysfunction
- Ear drops for otitis externa
- ENT referral for cholesteatoma, large perforation, or recurrent infections
- Watchful waiting for otitis media with effusion in children
 
Tone:
- Professional, objective, clinically precise
 
Risk-based behavior:
LOW RISK: Reassure, routine follow-up
MEDIUM RISK: Medical treatment, re-evaluation in 2–4 weeks
HIGH RISK: Urgent ENT referral, audiological evaluation
 
------------------------
OUTPUT FORMAT
------------------------
Return ONLY valid JSON. No explanation, no markdown.
 
{{
  "findings": "...",
  "abnormality": "...",
  "risk": 0-100,
  "risk_factors": {{
    "membrane_status": "...",
    "canal_condition": "...",
    "signs_of_infection": "...",
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
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import os
import io

def draw_dotted_line(c, x, y, width):
    c.setDash(1, 2)
    c.line(x, y, x + width, y)
    c.setDash()

def field(c, x, y, label, value="", width=80*mm, label_width=35*mm):
    c.setFont("Helvetica", 12)
    c.drawString(x, y, label)

    line_start = x + label_width
    draw_dotted_line(c, line_start, y - 2, width)

    if value:
        c.setFont("Helvetica", 11)
        c.drawString(line_start + 2, y + 1, str(value))

def create_dossier(data):
    packet = io.BytesIO()
    
    c = canvas.Canvas(packet, pagesize=A4)
    w, h = A4

    left_margin = 10 * mm
    right_margin = w - 10 * mm
    top_margin = h - 15 * mm
    line_height = 10 * mm

    # --- LOGO ---
    logo_path = "logo.png"
    if os.path.exists(logo_path):
        c.drawImage(logo_path, left_margin, top_margin - 10*mm, width=50*mm, preserveAspectRatio=True, mask='auto')
    else:
        print(f"Attention : Logo non trouvé à {logo_path}")

    # --- DOSSIER N° ---
    c.setFont("Helvetica-Bold", 18)
    c.drawString(right_margin - 85*mm, top_margin - 5*mm, "DOSSIER N° :")
    dossier_no = data.get("dossier_no", "")
    c.setFont("Helvetica", 14)
    c.drawString(right_margin - 40*mm, top_margin - 4*mm, dossier_no)
    draw_dotted_line(c, right_margin - 40*mm, top_margin - 6*mm, 35*mm)

    # --- IMPORT / EXPORT ---
    y = top_margin - 25*mm
    c.setFont("Helvetica-Bold", 16)
    mode = data.get("mode", "").lower()
    c.rect(left_margin + 45*mm, y - 1*mm, 6*mm, 6*mm)
    if mode == "import": c.drawString(left_margin + 46*mm, y, "X")
    c.drawString(left_margin + 55*mm, y, "import")
    
    c.rect(left_margin + 115*mm, y - 1*mm, 6*mm, 6*mm)
    if mode == "export": c.drawString(left_margin + 116*mm, y, "X")
    c.drawString(left_margin + 125*mm, y, "export")

    # --- TABLEAU EXPEDITEUR / DESTINATAIRE / MARCHANDISE ---
    y -= 12*mm
    table_height = 30*mm
    col1 = left_margin
    col2 = left_margin + 65*mm
    col3 = left_margin + 130*mm
    col_width = 65*mm

    c.setLineWidth(0.7)
    c.rect(left_margin, y - table_height, right_margin - left_margin, table_height)
    c.line(col2, y, col2, y - table_height)
    c.line(col3, y, col3, y - table_height)
    c.line(left_margin, y - 10*mm, right_margin, y - 10*mm)

    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(col1 + 32.5*mm, y - 7*mm, "Expéditeur")
    c.drawCentredString(col2 + 32.5*mm, y - 7*mm, "Destinataire")
    c.drawCentredString(col3 + 32.5*mm, y - 7*mm, "Marchandise")

    # Fonction améliorée pour afficher du texte avec retour à la ligne automatique
    def draw_wrapped_text(canvas, x, y_start, text, max_width, max_lines=3, line_height=3.5*mm, font_size=9):
        """Affiche du texte avec retour à la ligne automatique"""
        canvas.setFont("Helvetica", font_size)
        lines = []
        words = str(text).split()
        current_line = []
        
        for word in words:
            current_line.append(word)
            test_line = " ".join(current_line)
            text_width = canvas.stringWidth(test_line, "Helvetica", font_size)
            
            if text_width > max_width - 4*mm and len(current_line) > 1:
                # Garder tous les mots sauf le dernier pour la prochaine ligne
                lines.append(" ".join(current_line[:-1]))
                current_line = [current_line[-1]]
        
        # Ajouter la dernière ligne
        if current_line:
            lines.append(" ".join(current_line))
        
        # Limiter le nombre de lignes pour éviter le débordement
        lines = lines[:max_lines]
        
        # Afficher les lignes
        for i, line in enumerate(lines):
            canvas.drawString(x + 2*mm, y_start - (i * line_height) - 15*mm, line)
        
        # Retourne le nombre de lignes utilisées
        return len(lines)

    # Contenu du tableau avec gestion améliorée
    c.setFont("Helvetica", 9)
    max_text_width = col_width - 4*mm
    
    # Expéditeur
    exp_lines = draw_wrapped_text(c, col1, y - 5*mm, data.get("expediteur", ""), max_text_width)
    
    # Destinataire
    dest_lines = draw_wrapped_text(c, col2, y - 5*mm, data.get("destinataire", ""), max_text_width)
    
    # Marchandise
    march_lines = draw_wrapped_text(c, col3, y - 5*mm, data.get("marchandise", ""), max_text_width)

    # --- SECTION TRANSPORT ---
    # Ajuster l'espace en fonction du plus grand nombre de lignes
    max_lines_used = max(exp_lines, dest_lines, march_lines)
    y_offset = max_lines_used * 3.5 * mm
    
    y -= (table_height + 10*mm + y_offset)
    
    c.setLineWidth(1.5)
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)

    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(w/2, y - 11*mm, "TRANSPORT")

    y -= 15*mm
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)
    
    # Récupération de la valeur (ex: "complet" ou "groupage")
    nature = str(data.get("nature_chargement", "")).lower()

    y -= 10*mm
    c.setFont("Helvetica", 12)
    c.drawString(left_margin, y, "Nature de chargement :")

    # --- Case COMPLET ---
    c.rect(left_margin + 55*mm, y - 1*mm, 5*mm, 5*mm)
    if nature == "complet":
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left_margin + 56*mm, y, "X")

    c.setFont("Helvetica", 12)
    c.drawString(left_margin + 62*mm, y, "Complet")

    # --- Case GROUPAGE ---
    c.rect(left_margin + 100*mm, y - 1*mm, 5*mm, 5*mm)
    if nature == "groupage":
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left_margin + 101*mm, y, "X") 

    c.setFont("Helvetica", 12)
    c.drawString(left_margin + 107*mm, y, "Groupage")

    y -= line_height
    field(c, left_margin, y, "Agent maritime :", data.get("agent_marit", ""), 70*mm, 35*mm)
    field(c, left_margin + 110*mm, y, "Magasin :", data.get("magasin", ""), 45*mm, 20*mm)

    y -= line_height
    field(c, left_margin, y, "Port Embarquement :", data.get("port_emb", ""), 60*mm, 45*mm)
    field(c, left_margin + 120*mm, y, "Date :", data.get("date_emb", ""), 30*mm, 15*mm)

    y -= line_height
    field(c, left_margin, y, "Port Destination :", data.get("port_dest", ""), 65*mm, 40*mm)
    field(c, left_margin + 120*mm, y, "Date :", data.get("date_dest", ""), 30*mm, 15*mm)

    y -= line_height
    field(c, left_margin, y, "CTU N° / LTA N° :", data.get("ctu_lta", ""), 120*mm, 40*mm)

    y -= line_height
    field(c, left_margin, y, "Navire :", data.get("navire", ""), 50*mm, 20*mm)
    field(c, left_margin + 75*mm, y, "Escale :", data.get("escale", ""), 45*mm, 20*mm)
    field(c, left_margin + 145*mm, y, "Rubrique :", data.get("rubrique", ""), 30*mm, 25*mm)

    y -= line_height
    field(c, left_margin, y, "Colisage :", data.get("colisage", ""), 70*mm, 25*mm)
    field(c, left_margin + 110*mm, y, "P.B :", data.get("pb", ""), 50*mm, 15*mm)

    # --- SECTION DOUANE ---
    y -= 20*mm
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)

    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(w/2, y - 11*mm, "DOUANE")

    y -= 15*mm
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)

    y -= 10*mm
    field(c, left_margin, y, "Valeur devise :", data.get("valeur_devise", ""), 65*mm, 30*mm)
    field(c, left_margin + 100*mm, y, "Valeur dinars :", data.get("valeur_dinars", ""), 65*mm, 30*mm)

    y -= line_height
    field(c, left_margin, y, "DG :", data.get("dg", ""), 65*mm, 15*mm)
    field(c, left_margin + 100*mm, y, "Type déclaration :", data.get("type_declaration", ""), 55*mm, 40*mm)

    y -= line_height
    field(c, left_margin, y, "Déclaration N° :", data.get("declaration_no", ""), 60*mm, 35*mm)
    field(c, left_margin + 120*mm, y, "Date :", data.get("date_declaration", ""), 35*mm, 15*mm)

    y -= line_height
    field(c, left_margin, y, "Répertoire :", data.get("repertoire", ""), 60*mm, 25*mm)
    field(c, left_margin + 105*mm, y, "Banque domiciliaire :", data.get("banque", ""), 50*mm, 45*mm)

    c.showPage()
    c.save()

    packet.seek(0)
    return packet
    packet = io.BytesIO()
    
    c = canvas.Canvas(packet, pagesize=A4)
    w, h = A4

    left_margin = 10 * mm
    right_margin = w - 10 * mm
    top_margin = h - 15 * mm
    line_height = 10 * mm

    # --- LOGO ---
    logo_path = "logo.png"
    if os.path.exists(logo_path):
        c.drawImage(logo_path, left_margin, top_margin - 10*mm, width=50*mm, preserveAspectRatio=True, mask='auto')
    else:
        print(f"Attention : Logo non trouvé à {logo_path}")

    # --- DOSSIER N° ---
    c.setFont("Helvetica-Bold", 18)
    c.drawString(right_margin - 85*mm, top_margin - 5*mm, "DOSSIER N° :")
    dossier_no = data.get("dossier_no", "")
    c.setFont("Helvetica", 14)
    c.drawString(right_margin - 40*mm, top_margin - 4*mm, dossier_no)
    draw_dotted_line(c, right_margin - 40*mm, top_margin - 6*mm, 35*mm)

    # --- IMPORT / EXPORT ---
    y = top_margin - 25*mm
    c.setFont("Helvetica-Bold", 16)
    mode = data.get("mode", "").lower()
    c.rect(left_margin + 45*mm, y - 1*mm, 6*mm, 6*mm)
    if mode == "import": c.drawString(left_margin + 46*mm, y, "X")
    c.drawString(left_margin + 55*mm, y, "import")
    
    c.rect(left_margin + 115*mm, y - 1*mm, 6*mm, 6*mm)
    if mode == "export": c.drawString(left_margin + 116*mm, y, "X")
    c.drawString(left_margin + 125*mm, y, "export")

    # --- TABLEAU EXPEDITEUR / DESTINATAIRE / MARCHANDISE ---
    y -= 12*mm
    table_height = 30*mm
    col1 = left_margin
    col2 = left_margin + 65*mm
    col3 = left_margin + 130*mm
    col_width = 65*mm

    c.setLineWidth(0.7)
    c.rect(left_margin, y - table_height, right_margin - left_margin, table_height)
    c.line(col2, y, col2, y - table_height)
    c.line(col3, y, col3, y - table_height)
    c.line(left_margin, y - 10*mm, right_margin, y - 10*mm)

    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(col1 + 32.5*mm, y - 7*mm, "Expéditeur")
    c.drawCentredString(col2 + 32.5*mm, y - 7*mm, "Destinataire")
    c.drawCentredString(col3 + 32.5*mm, y - 7*mm, "Marchandise")

        # Fonction pour afficher du texte avec retour à la ligne automatique
    def draw_wrapped_text(canvas, x, y, text, max_width, line_height=3.5*mm):
        lines = []
        current_line = ""
        
        for word in str(text).split():
            # Vérifier si on peut ajouter le mot à la ligne courante
            test_line = current_line + (" " if current_line else "") + word
            text_width = canvas.stringWidth(test_line, "Helvetica", 9)
            
            if text_width <= max_width - 4:  # -4 pour la marge
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
        
        # Afficher les lignes (maximum 4 lignes pour éviter le débordement)
        max_lines = 4
        for i, line in enumerate(lines[:max_lines]):
            canvas.drawString(x + 2*mm, y - (i * line_height), line)

    # Contenu du tableau avec taille de police réduite
    c.setFont("Helvetica", 10)  # Réduit de 10 à 9
    max_text_width = col_width - 4*mm
    
    # Expéditeur
    draw_wrapped_text(c, col1, y - 18*mm, data.get("expediteur", ""), max_text_width)
    
    # Destinataire
    draw_wrapped_text(c, col2, y - 18*mm, data.get("destinataire", ""), max_text_width)
    
    # Marchandise
    draw_wrapped_text(c, col3, y - 18*mm, data.get("marchandise", ""), max_text_width)

    # --- SECTION TRANSPORT ---
    y -= 45*mm
    c.setLineWidth(1.5)
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)

    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(w/2, y - 11*mm, "TRANSPORT")

    y -= 15*mm
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)
    
# Récupération de la valeur (ex: "complet" ou "groupage")
    nature = str(data.get("nature_chargement", "")).lower()

    y -= 10*mm
    c.setFont("Helvetica", 12)
    c.drawString(left_margin, y, "Nature de chargement :")

    # --- Case COMPLET ---
    c.rect(left_margin + 55*mm, y - 1*mm, 5*mm, 5*mm)
    if nature == "complet":
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left_margin + 56*mm, y, "X")

    c.setFont("Helvetica", 12)
    c.drawString(left_margin + 62*mm, y, "Complet")

    # --- Case GROUPAGE ---
    c.rect(left_margin + 100*mm, y - 1*mm, 5*mm, 5*mm)
    if nature == "groupage":
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left_margin + 101*mm, y, "X") 

    c.setFont("Helvetica", 12)
    c.drawString(left_margin + 107*mm, y, "Groupage")

    y -= line_height
    field(c, left_margin, y, "Agent maritime :", data.get("agent_marit", ""), 70*mm, 35*mm)
    field(c, left_margin + 110*mm, y, "Magasin :", data.get("magasin", ""), 45*mm, 20*mm)

    y -= line_height
    field(c, left_margin, y, "Port Embarquement :", data.get("port_emb", ""), 60*mm, 45*mm)
    field(c, left_margin + 120*mm, y, "Date :", data.get("date_emb", ""), 30*mm, 15*mm)

    y -= line_height
    field(c, left_margin, y, "Port Destination :", data.get("port_dest", ""), 65*mm, 40*mm)
    field(c, left_margin + 120*mm, y, "Date :", data.get("date_dest", ""), 30*mm, 15*mm)

    y -= line_height
    # CORRECTION ICI : Fermeture des guillemets
    field(c, left_margin, y, "CTU N° / LTA N° :", data.get("ctu_lta", ""), 120*mm, 40*mm)

    y -= line_height
    field(c, left_margin, y, "Navire :", data.get("navire", ""), 50*mm, 20*mm)
    field(c, left_margin + 75*mm, y, "Escale :", data.get("escale", ""), 45*mm, 20*mm)
    field(c, left_margin + 145*mm, y, "Rubrique :", data.get("rubrique", ""), 30*mm, 25*mm)

    y -= line_height
    field(c, left_margin, y, "Colisage :", data.get("colisage", ""), 70*mm, 25*mm)
    field(c, left_margin + 110*mm, y, "P.B :", data.get("pb", ""), 50*mm, 15*mm)

    # --- SECTION DOUANE ---
    y -= 20*mm
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)

    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(w/2, y - 11*mm, "DOUANE")

    y -= 15*mm
    c.line(left_margin, y, right_margin, y)
    c.line(left_margin, y - 1*mm, right_margin, y - 1*mm)

    y -= 10*mm
    field(c, left_margin, y, "Valeur devise :", data.get("valeur_devise", ""), 65*mm, 30*mm)
    field(c, left_margin + 100*mm, y, "Valeur dinars :", data.get("valeur_dinars", ""), 65*mm, 30*mm)

    y -= line_height
    field(c, left_margin, y, "DG :", data.get("dg", ""), 65*mm, 15*mm)
    field(c, left_margin + 100*mm, y, "Type déclaration :", data.get("type_declaration", ""), 55*mm, 40*mm)

    y -= line_height
    field(c, left_margin, y, "Déclaration N° :", data.get("declaration_no", ""), 60*mm, 35*mm)
    field(c, left_margin + 120*mm, y, "Date :", data.get("date_declaration", ""), 35*mm, 15*mm)

    y -= line_height
    field(c, left_margin, y, "Répertoire :", data.get("repertoire", ""), 60*mm, 25*mm)
    field(c, left_margin + 105*mm, y, "Banque domiciliaire :", data.get("banque", ""), 50*mm, 45*mm)

    c.showPage()
    c.save()

    packet.seek(0)
    return packet


from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import mysql.connector
import math
from datetime import datetime

app = Flask(__name__)

# ✅ CORS liberado (pra ngrok funcionar sem dor)
# Depois a gente restringe para seu domínio do ngrok quando estiver tudo ok.
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ⚠️ Ajuste com seu MySQL
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "SUA_SENHA",
    "database": "fila_digital",
}

# -------------------------
# Rotas HTML que você já tinha
# -------------------------
@app.route("/")
def login():
    return render_template("login.html")

@app.route("/cnpj")
def cnpj():
    return render_template("cnpj.html")

# -------------------------
# Helpers de banco
# -------------------------
def db_conn():
    return mysql.connector.connect(**DB_CONFIG)

def haversine_m(lat1, lon1, lat2, lon2) -> float:
    """Distância em METROS entre duas coordenadas."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = (math.sin(dphi/2) ** 2) + math.cos(phi1) * math.cos(phi2) * (math.sin(dl/2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# -------------------------
# API: Info da fila (raio + coords do estabelecimento)
# GET /api/fila/<idFila>/info
# -------------------------
@app.get("/api/fila/<int:idFila>/info")
def fila_info(idFila):
    conn = db_conn()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT
            f.idFila, f.nome AS fila_nome, f.status,
            e.idEstabelecimento, e.nome AS estab_nome,
            e.latitude AS estab_lat, e.longitude AS estab_lng,
            e.raio_alerta
        FROM fila f
        JOIN estabelecimento e ON e.idEstabelecimento = f.estabelecimento_idEstabelecimento
        WHERE f.idFila = %s
        LIMIT 1
    """, (idFila,))

    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return jsonify({"ok": False, "error": "Fila não encontrada"}), 404

    return jsonify({
        "ok": True,
        "fila": {
            "idFila": row["idFila"],
            "nome": row["fila_nome"],
            "status": row["status"],
        },
        "estabelecimento": {
            "idEstabelecimento": row["idEstabelecimento"],
            "nome": row["estab_nome"],
            "lat": float(row["estab_lat"]) if row["estab_lat"] is not None else None,
            "lng": float(row["estab_lng"]) if row["estab_lng"] is not None else None,
            "raio_m": int(row["raio_alerta"]) if row["raio_alerta"] is not None else None,
        }
    })

# -------------------------
# API: Entrar na fila com geolocalização
# POST /api/fila/entrar
# body: { idFila, idCliente, lat, lng, accuracy_m }
# -------------------------
@app.post("/api/fila/entrar")
def fila_entrar():
    data = request.get_json(force=True)

    try:
        idFila = int(data["idFila"])
        idCliente = int(data["idCliente"])
        lat = float(data["lat"])
        lng = float(data["lng"])
        accuracy_m = float(data.get("accuracy_m", 999999))
    except Exception:
        return jsonify({"ok": False, "error": "Payload inválido"}), 400

    conn = db_conn()
    cur = conn.cursor(dictionary=True)

    # 1) Pega a fila + coords do estabelecimento + raio
    cur.execute("""
        SELECT
            f.idFila, f.status,
            e.idEstabelecimento, e.latitude AS estab_lat, e.longitude AS estab_lng, e.raio_alerta
        FROM fila f
        JOIN estabelecimento e ON e.idEstabelecimento = f.estabelecimento_idEstabelecimento
        WHERE f.idFila = %s
        LIMIT 1
    """, (idFila,))
    fila = cur.fetchone()

    if not fila:
        cur.close(); conn.close()
        return jsonify({"ok": False, "error": "Fila não encontrada"}), 404

    if fila["status"] != "ABERTA":
        cur.close(); conn.close()
        return jsonify({"ok": False, "error": "Fila está fechada"}), 403

    if fila["estab_lat"] is None or fila["estab_lng"] is None or fila["raio_alerta"] is None:
        cur.close(); conn.close()
        return jsonify({"ok": False, "error": "Estabelecimento sem latitude/longitude/raio configurados"}), 400

    estab_lat = float(fila["estab_lat"])
    estab_lng = float(fila["estab_lng"])
    raio_m = float(fila["raio_alerta"])

    # 2) Calcula distância (m)
    dist_m = haversine_m(lat, lng, estab_lat, estab_lng)

    # 3) Regras mínimas anti-bagunça
    #    (você pode ajustar depois)
    max_accuracy = 80.0  # <= 80m de precisão
    if accuracy_m > max_accuracy:
        cur.close(); conn.close()
        return jsonify({
            "ok": False,
            "error": "Localização imprecisa demais",
            "accuracy_m": accuracy_m,
            "max_allowed_accuracy_m": max_accuracy
        }), 400

    if dist_m > raio_m:
        cur.close(); conn.close()
        return jsonify({
            "ok": False,
            "error": "Fora do raio permitido",
            "distance_m": round(dist_m, 2),
            "allowed_radius_m": raio_m
        }), 403

    now = datetime.now()

    # 4) Atualiza cliente (lat/lng atual)
    cur.execute("""
        UPDATE cliente
        SET latitude_atual=%s, longitude_atual=%s, ultima_atualizacao=%s
        WHERE idCliente=%s
    """, (lat, lng, now, idCliente))

    # 5) Loga no histórico posicao_gps
    cur.execute("""
        INSERT INTO posicao_gps(latitude, longitude, data_ultima_atualizacao, cliente_idCliente)
        VALUES (%s, %s, %s, %s)
    """, (lat, lng, now, idCliente))

    # 6) Impede duplicar entrada na mesma fila (se já está AGUARDANDO/CHAMADO/EM_ATENDIMENTO)
    cur.execute("""
        SELECT idFilaCliente, status
        FROM fila_cliente
        WHERE fila_idFila=%s AND cliente_idCliente=%s
          AND status IN ('AGUARDANDO','CHAMADO','EM_ATENDIMENTO')
        LIMIT 1
    """, (idFila, idCliente))
    existente = cur.fetchone()

    if existente:
        conn.commit()
        cur.close(); conn.close()
        return jsonify({
            "ok": True,
            "message": "Você já está na fila",
            "distance_m": round(dist_m, 2),
            "allowed_radius_m": raio_m,
            "status": existente["status"]
        })

    # 7) Insere entrada na fila_cliente
    cur.execute("""
        INSERT INTO fila_cliente (fila_idFila, cliente_idCliente, status, data_entrada)
        VALUES (%s, %s, 'AGUARDANDO', %s)
    """, (idFila, idCliente, now))

    # 8) (Opcional) alerta
    cur.execute("""
        INSERT INTO alertas(tipo, mensagem, data_emissao, cliente_idCliente)
        VALUES ('ENTRADA_RAIO', %s, %s, %s)
    """, (f"Cliente {idCliente} entrou no raio e entrou na fila {idFila}. Dist={dist_m:.1f}m", now, idCliente))

    conn.commit()
    cur.close(); conn.close()

    return jsonify({
        "ok": True,
        "message": "Entrou na fila com sucesso",
        "distance_m": round(dist_m, 2),
        "allowed_radius_m": raio_m
    })

# -------------------------
# Rodar
# -------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8010, debug=True)
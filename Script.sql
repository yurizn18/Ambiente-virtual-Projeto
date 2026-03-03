DROP DATABASE IF EXISTS fila_digital;
CREATE DATABASE fila_digital;
USE fila_digital;


CREATE TABLE cliente (
  idCliente INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(45) NOT NULL,
  telefone VARCHAR(45),
  status ENUM('ATIVO','INATIVO') DEFAULT 'ATIVO',

  latitude_atual DECIMAL(10,8) NULL,
  longitude_atual DECIMAL(11,8) NULL,
  ultima_atualizacao DATETIME NULL
);


CREATE TABLE posicao_gps (
  idPosicaoGPS INT AUTO_INCREMENT PRIMARY KEY,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  data_ultima_atualizacao DATETIME NULL,

  cliente_idCliente INT NULL,
  CONSTRAINT fk_posicao_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


CREATE TABLE alertas (
  idAlertas INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('ENTRADA_RAIO','SAIDA_RAIO','OUTRO'),
  mensagem VARCHAR(255),
  data_emissao DATETIME NULL,

  cliente_idCliente INT NULL,
  CONSTRAINT fk_alerta_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


CREATE TABLE estabelecimento (
  idEstabelecimento INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(45) NOT NULL,
  cnpj VARCHAR(18),
  categoria ENUM('CLINICA','BARBEARIA','SALAO','ESTETICA','RESTAURANTE','ACOUGUE','SUPERMERCADO'),
  cidade VARCHAR(45),
  estado VARCHAR(45),
  telefone VARCHAR(15),

  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,

  raio_alerta INT NULL,

  email VARCHAR(120) NOT NULL UNIQUE,
  senha VARCHAR(120) NOT NULL
);


CREATE TABLE caixa (
  idCaixa INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(45)
);


CREATE TABLE atendimento (
  idAtendimento INT AUTO_INCREMENT PRIMARY KEY,
  data_inicio DATETIME NOT NULL,
  data_fim DATETIME NOT NULL,
  status ENUM('AGUARDANDO','EM_ATENDIMENTO','FINALIZADO'),
  servico VARCHAR(45),

  cliente_idCliente INT NULL,
  estabelecimento_idEstabelecimento INT NULL,
  caixa_idCaixa INT NULL,

  CONSTRAINT fk_atend_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_atend_estab
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_atend_caixa
    FOREIGN KEY (caixa_idCaixa) REFERENCES caixa(idCaixa)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


CREATE TABLE fila (
  idFila INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(60) NULL,

  status ENUM('ABERTA','FECHADA'),
  data_criacao DATETIME NULL,
  data_fechamento DATETIME NULL,

  endereco VARCHAR(255) NULL,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  raio_km DECIMAL(5,2) DEFAULT 0.20,

  cliente_idCliente INT NULL,
  estabelecimento_idEstabelecimento INT NULL,

  CONSTRAINT fk_fila_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_fila_estab
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


CREATE TABLE qr_code (
  idQRCode INT AUTO_INCREMENT PRIMARY KEY,
  data_criacao DATETIME NULL,

  fila_idFila INT NULL,
  cliente_idCliente INT NULL,
  estabelecimento_idEstabelecimento INT NULL,

  CONSTRAINT fk_qr_fila
    FOREIGN KEY (fila_idFila) REFERENCES fila(idFila)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_qr_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_qr_estab
    FOREIGN KEY (estabelecimento_idEstabelecimento) REFERENCES estabelecimento(idEstabelecimento)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);


CREATE TABLE fila_cliente (
  idFilaCliente INT AUTO_INCREMENT PRIMARY KEY,
  fila_idFila INT NOT NULL,
  cliente_idCliente INT NOT NULL,

  status ENUM('AGUARDANDO','CHAMADO','EM_ATENDIMENTO','FINALIZADO','SAIU') DEFAULT 'AGUARDANDO',
  senha_codigo VARCHAR(10) NULL,
  data_entrada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_inicio_atendimento DATETIME NULL,
  data_fim_atendimento DATETIME NULL,
  data_saida DATETIME NULL,

  CONSTRAINT fk_fc_fila
    FOREIGN KEY (fila_idFila) REFERENCES fila(idFila)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_fc_cliente
    FOREIGN KEY (cliente_idCliente) REFERENCES cliente(idCliente)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);


CREATE INDEX idx_fc_fila_status_data
  ON fila_cliente (fila_idFila, status, data_entrada);

CREATE INDEX idx_fc_fila_status_fim
  ON fila_cliente (fila_idFila, status, data_fim_atendimento);
import argparse
import os
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from history_runtime import consult, ROOT, Client
parser = argparse.ArgumentParser()
parser.add_argument('--profile', choices=('limpatexconsultor', 'limpatexoperaciones', 'limpatexrentabilidad'), required=True)
args = parser.parse_args()
os.environ['HERMES_HOME'] = str(ROOT / 'profiles' / args.profile)
sys.path.insert(0, str(ROOT / 'hermes-agent'))
import hermes_bootstrap
try:
    from mcp.server.mcpserver import MCPServer
    from mcp_types import ToolAnnotations
except ImportError:
    from mcp.server.fastmcp import FastMCP as MCPServer
    from mcp.types import ToolAnnotations
server = MCPServer('Limpatex · Historico compartido')


@server.tool(annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=True))
def historial_equipo(consulta: str = 'resumen', identificador: str = '', busqueda: str = '', limite: int = 20, inicio: int = 0) -> dict:
    """Historico desde junio 2026, incremental diario y verificacion semanal. Consulta resumen, trabajador, edificio o propiedad; selecciona un ID si hay ambiguedad y pagina hay_mas. Incluye habitos con tareas pendientes, reparto previsto hoy+14 dias y reportes por trabajador con resumen y comparativa 30 dias. No equipares pendiente a ejecutada, ni ausencia en servidor a incumplimiento: puede quedar envio offline. Respeta casos no evaluables, fecha, desactualizado y reglas actuales. Consultor/Operaciones ven fichas; Rentabilidad solo resumen. No mide calidad ni modifica tareas o reportes."""
    Client(args.profile).read()  # A revoked identity cannot keep reading the cache.
    return consult(args.profile, consulta, identificador, busqueda, limite, inicio)


if __name__ == '__main__':
    server.run(transport='stdio')

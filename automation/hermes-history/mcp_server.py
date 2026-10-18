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
    """Historico desde junio 2026, actualizado una vez al dia. Consulta resumen, trabajador, edificio o propiedad; selecciona un ID si hay ambiguedad y pagina hay_mas. Consultor/Operaciones ven fichas; Rentabilidad solo resumen. No es calidad, preferencia confirmada ni disponibilidad actual. Respeta desactualizado, equipos/exclusiones y consulta la app antes de proponer. No modifica asignaciones."""
    Client(args.profile).read()  # A revoked identity cannot keep reading the cache.
    return consult(args.profile, consulta, identificador, busqueda, limite, inicio)


if __name__ == '__main__':
    server.run(transport='stdio')

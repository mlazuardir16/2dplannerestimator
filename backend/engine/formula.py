"""Tiny, safe evaluator for the Excel-style volume formulas in the seed.

The seed stores derived volumes as workbook formulas (`=Volume!$B$6*Volume!$B$7`).
`excel_to_expr` rewrites cell references into volume keys (`W*D`) so formulas
stay readable and editable without the workbook; `evaluate` then computes them
by walking the Python AST — only arithmetic, volume names and a whitelist of
Excel functions are allowed, never `eval`.
"""

import ast
import math
import operator
import re
from typing import Callable, Dict, Mapping

_CELL_REF = re.compile(r"(?:Volume!)?\$?B\$?(\d+)")

_FUNCTIONS: Dict[str, Callable[..., float]] = {
    "TAN": math.tan,
    "COS": math.cos,
    "SIN": math.sin,
    "RADIANS": math.radians,
    "SQRT": math.sqrt,
    "ABS": abs,
    "MIN": min,
    "MAX": max,
    "PI": lambda: math.pi,
}

_BINOPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}
_UNARYOPS = {ast.USub: operator.neg, ast.UAdd: operator.pos}


def excel_to_expr(formula: str, row_to_key: Mapping[int, str]) -> str:
    """`=2*(Volume!$B$6+Volume!$B$7)` -> `2*(W+D)`."""
    body = formula[1:] if formula.startswith("=") else formula

    def repl(m: re.Match) -> str:
        row = int(m.group(1))
        if row not in row_to_key:
            raise ValueError(f"Formula {formula!r} references unknown row {row}")
        return row_to_key[row]

    return _CELL_REF.sub(repl, body)


def referenced_names(expr: str) -> set:
    tree = ast.parse(_to_python(expr), mode="eval")
    return {
        n.id for n in ast.walk(tree)
        if isinstance(n, ast.Name) and n.id not in _FUNCTIONS
    }


def evaluate(expr, resolve: Callable[[str], float]) -> float:
    """Evaluate a number or expression; `resolve(name)` supplies volume keys."""
    if isinstance(expr, (int, float)):
        return float(expr)
    tree = ast.parse(_to_python(str(expr)), mode="eval")
    return float(_eval_node(tree.body, resolve))


def _to_python(expr: str) -> str:
    expr = expr.strip()
    if expr.startswith("="):
        expr = expr[1:]
    return expr.replace("^", "**")


def _eval_node(node: ast.AST, resolve: Callable[[str], float]) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.Name):
        return resolve(node.id)
    if isinstance(node, ast.BinOp) and type(node.op) in _BINOPS:
        return _BINOPS[type(node.op)](_eval_node(node.left, resolve), _eval_node(node.right, resolve))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARYOPS:
        return _UNARYOPS[type(node.op)](_eval_node(node.operand, resolve))
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id.upper() in _FUNCTIONS
        and not node.keywords
    ):
        args = [_eval_node(a, resolve) for a in node.args]
        return _FUNCTIONS[node.func.id.upper()](*args)
    raise ValueError(f"Unsupported formula element: {ast.dump(node)}")

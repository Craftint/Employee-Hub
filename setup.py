# Employee Hub — developed by Sebin P Sabu (sebin.freelance@gmail.com)

from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

setup(
    name="employee_hub",
    version="0.0.1",
    description="Personalized Employee Self-Service Hub for ERPNext",
    author="SEBIN-P-SABU",
    author_email="sebin.freelance@gmail.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
